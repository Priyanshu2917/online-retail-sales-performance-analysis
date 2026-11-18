# Online Retail Sales Performance Analysis

A portfolio-ready, end-to-end Data Analyst project built around a realistic online retail transaction dataset. It demonstrates the workflow expected in entry-level analyst roles: data cleaning, KPI definition, exploratory analysis, SQL, Excel reporting, Power BI preparation, and evidence-based recommendations.

## Business problem

An online retailer needs a reliable view of sales performance. The project answers:

- How are revenue, orders, units sold, and average order value changing by month?
- Which countries and merchandise SKUs contribute the most commercial value?
- Which customers are valuable, recently active, or at risk of lapsing?
- Which data-quality choices affect the KPI population?

Detailed business context and KPI definitions are in [docs/business_problem.md](docs/business_problem.md).

## Dataset

The project uses the [UCI Online Retail II dataset](https://archive.ics.uci.edu/dataset/502/online+retail+ii): anonymized transactions from a UK-based non-store retailer from December 2009 to December 2011. The UCI source documents the data fields, period, and CC BY 4.0 license.

The source workbook is downloaded reproducibly by `src/download_data.py`. It is not committed because of its size.

## Skills demonstrated

- Excel: dashboard workbook, native editable charts, formulas, formatted tables, and a data-quality view.
- SQL: reusable SQLite schema and business queries with CTEs, window functions, rankings, and segmentation logic.
- Python: pandas cleaning, EDA, RFM segmentation, SQLite export, validation checks, and chart generation.
- Power BI: dashboard-ready fact and summary CSVs plus DAX measures and a build specification.

## Project structure

```text
retail-sales-performance-analysis/
|-- data/
|   |-- raw/                         # Source workbook downloaded here
|   `-- processed/                   # Generated analysis outputs
|-- docs/
|   |-- business_problem.md
|   |-- dashboard_specification.md
|   |-- data_dictionary.md
|   |-- generated_insights.md        # Written after running the analysis
|   `-- validation.md
|-- excel/
|   `-- Online_Retail_Analysis.xlsx  # Native Excel dashboard
|-- sql/
|   |-- 01_create_schema.sql
|   |-- 02_kpi_queries.sql
|   `-- 03_customer_segmentation.sql
|-- src/
|   |-- analysis.py
|   |-- build_excel_dashboard.mjs
|   `-- download_data.py
|-- requirements.txt
`-- README.md
```

## Run the project

1. Create and activate a Python virtual environment.
2. Install packages:

   ```powershell
   pip install -r requirements.txt
   ```

3. Download the documented source dataset:

   ```powershell
   python src/download_data.py
   ```

4. Run the full cleaning and analysis pipeline:

   ```powershell
   python src/analysis.py
   ```

5. Build the native Excel dashboard from the generated CSV outputs:

   ```powershell
   node src/build_excel_dashboard.mjs
   ```

The analysis writes its outputs to `data/processed/`. The SQL files can be run against `data/processed/online_retail_analysis.sqlite` using SQLite, DB Browser for SQLite, or a database client.

## Cleaning rules

The commercial fact table includes only positive completed sale lines. It excludes exact duplicate rows, cancellation invoices, blank invoice IDs, invalid dates, non-positive quantities, and non-positive unit prices. Rows without customer IDs remain in revenue and order KPIs but do not enter customer-level analysis. Non-merchandise service codes are tagged rather than silently deleted; the product ranking filters to merchandise only.

Every run produces `data_quality_report.csv` and `validation_results.csv` so the final dashboard remains traceable to its source population.

## Dashboard and Power BI

`excel/Online_Retail_Analysis.xlsx` is an editable Excel dashboard with KPI formulas, four native charts, supporting tables, a source-data sample, and quality checks. For Power BI, import `dashboard_fact_sales.csv` and follow [docs/dashboard_specification.md](docs/dashboard_specification.md). A `.pbix` file cannot be authored reliably in this environment, so the project provides Power BI-ready data and exact measures instead of a fake dashboard file.

## Portfolio talking points

- Defined a transparent sales population rather than treating raw transaction lines as revenue by default.
- Reconciled headline revenue across monthly, country, and merchandise views before publishing conclusions.
- Used RFM-style customer segments to turn transaction data into retention actions.
- Produced the same business logic in Python, SQL, Excel, and a Power BI-ready model.

## Important limitation

This is a historical, anonymized educational dataset. It has no marketing cost, product margin, inventory, customer demographic, or web-session data. Recommendations therefore focus on measurable sales, customer retention, and assortment hypotheses rather than claiming profitability or causal impact.
