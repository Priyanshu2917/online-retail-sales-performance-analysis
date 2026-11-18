# Business Problem and KPIs

## Context

The retailer sells a broad range of products through a non-store channel. Leadership needs a dependable way to monitor sales, compare markets and products, and identify customer groups for retention activity.

## Analytical objective

Build a repeatable sales-performance reporting layer from transactional data. The output should support weekly or monthly commercial reviews without mixing returns, cancellations, data errors, and completed sales.

## Questions

1. What is the trend in completed-sales revenue, orders, units, and average order value?
2. Which countries and merchandise items account for the largest share of revenue?
3. Which customer groups are highly engaged, new, or at risk of lapsing?
4. Are the totals traceable back to a clearly defined, quality-checked fact table?

## KPI definitions

| KPI | Definition | Calculation |
|---|---|---|
| Total revenue | Value of positive completed sales lines | Sum of `quantity * unit_price` |
| Orders | Distinct completed invoice keys | Distinct `source_sheet + invoice_no` |
| Average order value | Mean revenue per completed order | Total revenue / orders |
| Units sold | Positive item units on completed sales lines | Sum of quantity |
| Known customers | Customers with a valid source customer ID | Distinct customer ID excluding blanks |
| Revenue share | Contribution to clean revenue | Group revenue / total revenue |
| Recency | Days since a known customer's latest order | Latest source date + 1 day - last purchase |

## Scope rules

The project treats an invoice beginning with `C` as a cancellation and excludes it from the sales fact table. Returns, zero-priced lines, invalid dates, and blank invoice IDs are also excluded. Missing customer IDs are retained for sales KPIs because they are valid transactions, but they are excluded from RFM customer segmentation.
