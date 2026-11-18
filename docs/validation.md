# Validation Approach

The pipeline fails rather than silently publishing a dashboard when a required reconciliation breaks. `validation_results.csv` records the final status for these checks:

| Check | Why it matters |
|---|---|
| No cancellation invoice is in the fact table | Prevents reversed transactions from appearing as revenue. |
| Quantity and unit price are positive | Prevents returns, adjustments, and free lines from distorting completed-sales KPIs. |
| Monthly revenue equals fact-table revenue | Confirms time aggregation does not omit or duplicate sales. |
| Country revenue equals fact-table revenue | Confirms geography aggregation is complete. |
| Merchandise product revenue reconciles | Confirms product reporting applies the documented merchandise scope. |
| Customer-segment revenue equals known-customer revenue | Confirms RFM buckets cover each known customer once. |
| Order keys are complete | Confirms order and average-order-value calculations have a valid denominator. |

The checks use full-precision values and `numpy.isclose` for floating-point comparison. Dashboard display rounding does not determine whether a reconciliation passes.
