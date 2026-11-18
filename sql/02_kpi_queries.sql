-- Run against data/processed/online_retail_analysis.sqlite.

-- 1. Headline KPI snapshot.
SELECT
    ROUND(SUM(sales_amount), 2) AS total_revenue,
    COUNT(DISTINCT invoice_key) AS orders,
    ROUND(SUM(sales_amount) / COUNT(DISTINCT invoice_key), 2) AS average_order_value,
    SUM(quantity) AS units_sold,
    COUNT(DISTINCT customer_id) AS known_customers
FROM sales_clean;

-- 2. Monthly trend with month-over-month revenue change.
WITH monthly AS (
    SELECT
        year_month,
        SUM(sales_amount) AS revenue,
        COUNT(DISTINCT invoice_key) AS orders,
        SUM(quantity) AS units_sold
    FROM sales_clean
    GROUP BY year_month
)
SELECT
    year_month,
    ROUND(revenue, 2) AS revenue,
    orders,
    units_sold,
    ROUND(revenue / orders, 2) AS average_order_value,
    ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY year_month)) /
        NULLIF(LAG(revenue) OVER (ORDER BY year_month), 0), 2) AS revenue_mom_pct
FROM monthly
ORDER BY year_month;

-- 3. Country performance and contribution to total revenue.
SELECT
    country,
    ROUND(SUM(sales_amount), 2) AS revenue,
    COUNT(DISTINCT invoice_key) AS orders,
    ROUND(SUM(sales_amount) / COUNT(DISTINCT invoice_key), 2) AS average_order_value,
    ROUND(100.0 * SUM(sales_amount) / SUM(SUM(sales_amount)) OVER (), 2) AS revenue_share_pct
FROM sales_clean
GROUP BY country
ORDER BY revenue DESC;

-- 4. Top merchandise items. Service and adjustment codes are excluded by the documented flag.
SELECT
    stock_code,
    description,
    ROUND(SUM(sales_amount), 2) AS revenue,
    SUM(quantity) AS units_sold,
    COUNT(DISTINCT invoice_key) AS orders,
    DENSE_RANK() OVER (ORDER BY SUM(sales_amount) DESC) AS revenue_rank
FROM sales_clean
WHERE is_merchandise = 1
GROUP BY stock_code, description
ORDER BY revenue DESC
LIMIT 20;

-- 5. Day and hour pattern for operational planning.
SELECT
    weekday,
    hour,
    ROUND(SUM(sales_amount), 2) AS revenue,
    COUNT(DISTINCT invoice_key) AS orders
FROM sales_clean
GROUP BY weekday, hour
ORDER BY revenue DESC;
