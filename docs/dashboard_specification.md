# Dashboard Specification

## Excel dashboard

The generated workbook has one primary view, `Dashboard`, supported by monthly, country, product, customer, quality, and fact-sample tabs. It uses formula-linked KPIs and native editable charts:

1. Monthly revenue trend.
2. Revenue by top country.
3. Revenue by top merchandise item.
4. Customer count by RFM segment.

The dashboard presents monetary values in the source dataset's price units, not a guessed currency.

## Power BI implementation

The project does not ship a `.pbix` file because this environment cannot reliably generate a native Power BI file. Use the prepared files in `data/processed/` to create it in Power BI Desktop.

1. Import `dashboard_fact_sales.csv` as `Fact Sales`.
2. Import `dashboard_country_performance.csv`, `dashboard_product_performance.csv`, and `dashboard_customer_segments.csv` only when you want pre-aggregated supporting views. Do not relate these summaries back to `Fact Sales`, because that would double-count revenue.
3. In `Fact Sales`, change `invoice_date` to Date/Time and `transaction_date` to Date.
4. Create a Date table and relate `Date[Date]` to `Fact Sales[transaction_date]`.
5. Add the measures below, then build the four visuals listed under `Recommended layout`.

```DAX
Date =
ADDCOLUMNS (
    CALENDAR ( MIN ( 'Fact Sales'[transaction_date] ), MAX ( 'Fact Sales'[transaction_date] ) ),
    "Year", YEAR ( [Date] ),
    "Month Number", MONTH ( [Date] ),
    "Month", FORMAT ( [Date], "MMM" ),
    "Year Month", FORMAT ( [Date], "YYYY-MM" )
)

Total Revenue = SUM ( 'Fact Sales'[sales_amount] )

Orders = DISTINCTCOUNT ( 'Fact Sales'[invoice_key] )

Average Order Value = DIVIDE ( [Total Revenue], [Orders] )

Units Sold = SUM ( 'Fact Sales'[quantity] )

Known Customers =
CALCULATE (
    DISTINCTCOUNT ( 'Fact Sales'[customer_id] ),
    FILTER ( 'Fact Sales', NOT ( ISBLANK ( 'Fact Sales'[customer_id] ) ) )
)

Revenue Share by Country =
DIVIDE ( [Total Revenue], CALCULATE ( [Total Revenue], ALL ( 'Fact Sales'[country] ) ) )
```

## Recommended layout

- KPI cards: Total Revenue, Orders, Average Order Value, Units Sold, Known Customers.
- Line chart: `Date[Year Month]` by `[Total Revenue]`.
- Horizontal bar chart: `country` by `[Total Revenue]`, Top N 10.
- Horizontal bar chart: `description` by `[Total Revenue]`, filtered to `is_merchandise = TRUE`, Top N 10.
- Bar or donut chart: `segment` from `dashboard_customer_segments.csv` by customers.
- Slicers: Year, country, merchandise flag, and weekday.

## Validation before publishing

Reconcile total revenue in Power BI to `kpi_summary.csv`, make sure the final source month is labelled partial if it ends before month-end, and confirm that cancellations are absent from the fact table. The project already records these tests in `validation_results.csv`.
