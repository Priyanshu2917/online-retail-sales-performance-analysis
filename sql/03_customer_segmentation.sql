-- RFM-style customer segmentation in SQLite.
-- Python uses deterministic rank-based quintiles; this query expresses the same business concept in SQL.

WITH customer_base AS (
    SELECT
        customer_id,
        MAX(transaction_date) AS last_purchase_date,
        COUNT(DISTINCT invoice_key) AS orders,
        SUM(sales_amount) AS revenue
    FROM sales_clean
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
),
as_of AS (
    SELECT DATE(MAX(transaction_date), '+1 day') AS as_of_date
    FROM sales_clean
),
rfm AS (
    SELECT
        customer_id,
        CAST(JULIANDAY(as_of.as_of_date) - JULIANDAY(last_purchase_date) AS INTEGER) AS recency_days,
        orders,
        revenue
    FROM customer_base
    CROSS JOIN as_of
),
scored AS (
    SELECT
        *,
        NTILE(5) OVER (ORDER BY recency_days DESC, customer_id) AS recency_score,
        NTILE(5) OVER (ORDER BY orders ASC, customer_id) AS frequency_score,
        NTILE(5) OVER (ORDER BY revenue ASC, customer_id) AS monetary_score
    FROM rfm
)
SELECT
    customer_id,
    recency_days,
    orders,
    ROUND(revenue, 2) AS revenue,
    recency_score,
    frequency_score,
    monetary_score,
    CASE
        WHEN recency_score >= 4 AND frequency_score >= 4 AND monetary_score >= 4 THEN 'Champions'
        WHEN recency_score <= 2 AND frequency_score >= 3 THEN 'At Risk'
        WHEN frequency_score >= 3 AND monetary_score >= 3 THEN 'Loyal Customers'
        WHEN recency_score >= 4 AND frequency_score = 1 THEN 'New Customers'
        WHEN recency_score >= 4 AND frequency_score <= 2 THEN 'Potential'
        ELSE 'Needs Attention'
    END AS segment
FROM scored
ORDER BY revenue DESC;
