# Online Retail Sales Performance Analysis

[![Python](https://img.shields.io/badge/Python-Pandas%20%7C%20NumPy-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![SQL](https://img.shields.io/badge/SQL-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Excel](https://img.shields.io/badge/Excel-Interactive%20Dashboard-217346?logo=microsoftexcel&logoColor=white)](excel/Online_Retail_Analysis.xlsx)
[![Power BI](https://img.shields.io/badge/Power%20BI-Ready-F2C811?logo=powerbi&logoColor=111111)](docs/dashboard_specification.md)

> An end-to-end data analytics portfolio project that turns raw retail transactions into validated business KPIs, an editable Excel dashboard, reusable SQL, and Power BI-ready outputs.

**Start here:** [Open the Excel dashboard](excel/Online_Retail_Analysis.xlsx) · [Read the business problem](docs/business_problem.md) · [Review SQL queries](sql) · [See the Power BI build guide](docs/dashboard_specification.md)

---

## Project overview

Retail transaction data can look clean while still containing cancellations, returns, duplicate records, blank customer IDs, and incomplete reporting periods. This project builds a transparent sales-performance reporting workflow for a UK-based online retailer using the UCI Online Retail II dataset.

The analysis defines a reliable completed-sales population before answering commercial questions about sales trends, geography, products, and customer retention. Every published KPI reconciles back to the cleaned fact table.

### Project at a glance

| Metric | Result | Definition |
|---|---:|---|
| Clean revenue | 20,476,260.45 | Sum of positive completed-sale line amounts |
| Orders | 40,077 | Distinct cleaned invoice keys |
| Average order value | 510.92 | Clean revenue divided by orders |
| Units sold | 11,205,148 | Sum of included item quantities |
| Known customers | 5,878 | Customers with a usable ID |
| Analysis period | Dec 2009 to Dec 2011 | Final month ends on 9 Dec and is labelled partial |
| Validated sales rows | 1,007,913 | Positive completed-sale rows used in commercial KPIs |

> Monetary values retain the source dataset's price units. No currency has been assumed where the source does not explicitly document one.

## Business problem

The retailer needs a dependable view of sales performance, not a dashboard that simply aggregates every raw record. The work addresses four practical questions:

1. How are revenue, orders, units sold, and average order value changing over time?
2. Which countries and merchandise SKUs contribute the most value?
3. Which customers are valuable, recently active, or candidates for retention activity?
4. Which data-quality rules materially define the KPI population?

The detailed scope, stakeholders, KPI definitions, and acceptance criteria are documented in [Business Problem](docs/business_problem.md).

## Analytical workflow

~~~mermaid
flowchart LR
    A[UCI source workbook] --> B[Python ingestion and profiling]
    B --> C[Cleaning and sales-population rules]
    C --> D[Validated sales fact table]
    D --> E[KPIs and exploratory analysis]
    E --> F[SQLite queries]
    E --> G[Excel dashboard]
    E --> H[Power BI-ready CSVs and DAX guide]
    E --> I[Recommendations and validation evidence]
~~~

This workflow is intentionally reproducible: source download, transformation, reporting outputs, data-quality evidence, and validation checks are all defined in the repository.

## Skills demonstrated

| Area | What this project demonstrates |
|---|---|
| **Excel** | Editable workbook, formula-linked KPI cards, native charts, formatted tables, quality checks, and a fact-table sample |
| **SQL** | SQLite schema creation, KPI aggregation, monthly trend analysis, country and product ranking, and RFM-style customer segmentation |
| **Python** | Data cleaning with Pandas, EDA, grouped KPI calculation, RFM segmentation, SQLite export, validation, and report generation |
| **Power BI** | A fact table, supporting outputs, DAX measures, visual design guidance, and publishing checks |
| **Business analysis** | KPI governance, source-to-dashboard traceability, data-quality decisions, insight framing, and measurable recommendations |

## Dataset and scope

The project uses the [UCI Online Retail II dataset](https://archive.ics.uci.edu/dataset/502/online+retail+ii), an anonymized transaction dataset for a UK-based non-store retailer. It covers transactions from December 2009 to December 2011 and is published by UCI under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The source workbook is intentionally not committed because of its size. Download it reproducibly with [src/download_data.py](src/download_data.py).

### Commercial fact-table definition

A row enters the sales fact table only when it:

- has a valid invoice identifier and transaction date;
- is not a cancellation invoice;
- has a quantity greater than zero; and
- has a unit price greater than zero.

Rows with no customer ID remain in revenue, order, and unit KPIs, but are excluded from customer-level analysis because they cannot be attributed to an individual customer.

## Data quality and validation

| Stage | Rows | Treatment |
|---|---:|---|
| Raw source loaded | 1,067,371 | Both source worksheets combined |
| Exact duplicates removed | 34,335 | Duplicate rows removed before KPI creation |
| Population evaluated | 1,033,036 | Rows assessed against sales rules |
| Clean completed sales | 1,007,913 | Final commercial fact-table population |
| Rows without customer ID | 228,488 | Retained in sales KPIs; excluded from RFM analysis |

Cancellation, quantity, and price exclusion counts can overlap, so they should not be summed as independent removals. The full audit is available in [data_quality_report.csv](data/processed/data_quality_report.csv).

Eight automated checks validate the final dataset, including positive quantities and prices, no cancelled invoices, populated order keys, and reconciliation of revenue across monthly, country, merchandise, and customer-segment views. See [validation_results.csv](data/processed/validation_results.csv) and [validation documentation](docs/validation.md).

## Dashboard deliverables

### Excel dashboard

The included [Online Retail Analysis workbook](excel/Online_Retail_Analysis.xlsx) is ready to open and edit. Its primary **Dashboard** sheet is supported by:

- **Monthly KPIs** — revenue, orders, units, customer count, average order value, and month-over-month change;
- **Countries** — country performance and revenue contribution;
- **Products** — merchandise-only SKU performance;
- **Customers** — RFM-style customer output and segments;
- **Data Quality** — cleaning decisions and validation evidence;
- **Fact Sample** — a traceable transaction sample; and
- **Read Me** — instructions for using the workbook.

The dashboard contains native Excel charts for monthly revenue, top countries, top merchandise products, and customer segments. It is formula-linked rather than a static image, so it can be inspected and extended in Excel.

### Power BI-ready model

After running the Python pipeline, import the generated fact and summary CSVs from the processed-data folder into Power BI Desktop. The [dashboard specification](docs/dashboard_specification.md) provides:

- the recommended data model;
- DAX for Total Revenue, Orders, Average Order Value, Units Sold, Known Customers, and country revenue share;
- visual and slicer recommendations; and
- a pre-publication reconciliation checklist.

A native PBIX file is not included because it cannot be reliably authored in this environment. The project instead supplies transparent data, measures, and build instructions rather than a non-functional placeholder file.

## Key findings and recommendations

All findings below use the validated completed-sales fact table. They are descriptive observations, not claims of causality.

| Evidence | Business recommendation |
|---|---|
| The United Kingdom represents **85.0%** of clean sales revenue. | Protect the core market: track repeat demand, customer service, and fulfilment performance in the UK. |
| **EIRE** is the highest-revenue non-UK market, contributing **3.2%** of clean revenue. | Run a small, measurable retention or promotion test before expanding international spend. |
| The top 10 merchandise SKUs produce **7.8%** of merchandise revenue. SKU **22423 — REGENCY CAKESTAND 3 TIER** leads the ranking. | Review availability and replenishment for high-revenue products, while avoiding decisions based on revenue alone. |
| The RFM **At Risk** segment contributes **8.9%** of known-customer revenue. The peak complete month is **2011-11**. | Test a win-back offer against a holdout group and measure incremental repeat orders. |

The full recommendation log is available in [dashboard_recommendations.csv](data/processed/dashboard_recommendations.csv), and the narrative version is in [generated_insights.md](docs/generated_insights.md).

## SQL analysis

The SQL folder contains analyst-ready scripts that run against the generated SQLite database:

| File | Purpose |
|---|---|
| [01_create_schema.sql](sql/01_create_schema.sql) | Defines the cleaned sales and supporting analysis tables |
| [02_kpi_queries.sql](sql/02_kpi_queries.sql) | Produces headline KPIs, trends, geography, and product analysis |
| [03_customer_segmentation.sql](sql/03_customer_segmentation.sql) | Produces customer segmentation and retention-oriented views |

Run the scripts against the generated **data/processed/online_retail_analysis.sqlite** database using SQLite, DB Browser for SQLite, DBeaver, or another SQL client.

## Repository structure

~~~text
retail-sales-performance-analysis/
├── data/
│   ├── raw/                          # Source workbook is downloaded here
│   └── processed/                    # Generated facts, summaries, checks, and SQLite DB
├── docs/
│   ├── business_problem.md
│   ├── dashboard_specification.md
│   ├── data_dictionary.md
│   ├── generated_insights.md
│   └── validation.md
├── excel/
│   └── Online_Retail_Analysis.xlsx   # Editable dashboard deliverable
├── sql/
│   ├── 01_create_schema.sql
│   ├── 02_kpi_queries.sql
│   └── 03_customer_segmentation.sql
├── src/
│   ├── analysis.py                   # Cleaning, analysis, validation, and exports
│   ├── build_excel_dashboard.mjs     # Dashboard-generation source
│   └── download_data.py              # Reproducible UCI source download
├── requirements.txt
└── README.md
~~~

## Reproduce the analysis

### Prerequisites

- Python 3.10 or later
- Internet access to download the documented UCI source workbook
- Optional: a SQLite client for running the SQL scripts
- Optional: Microsoft Excel or a compatible desktop spreadsheet application

### Run on Windows PowerShell

~~~powershell
git clone https://github.com/Priyanshu2917/online-retail-sales-performance-analysis.git
cd online-retail-sales-performance-analysis

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python src/download_data.py
python src/analysis.py
~~~

The pipeline writes the cleaned fact table, dashboard-ready files, quality report, validation results, recommendations, and SQLite database to the processed-data folder.

The ready-to-use Excel workbook is already included. The optional dashboard-generation script was used to create that workbook in the Codex spreadsheet environment; standard local reproduction of the core Python and SQL analysis does not depend on it.

## Portfolio talking points

- I defined sales as **positive completed transactions**, rather than treating every raw record as revenue.
- I reconciled headline revenue across monthly, country, merchandise, and customer-segment views before reporting insights.
- I preserved unattributed transactions in company-level sales KPIs while preventing them from distorting customer analysis.
- I translated transaction-level data into operational actions for market focus, SKU availability, and retention testing.
- I delivered the same business logic across Python, SQL, Excel, and a Power BI-ready model.

## Limitations

- The source is a historical, anonymized educational dataset; it is not live operational data.
- Margin, marketing spend, inventory, delivery status, web traffic, and customer demographics are unavailable. The analysis therefore does not claim profitability, campaign ROI, or causal impact.
- The final source month ends before month-end and is treated as partial in trend interpretation.
- Product rankings are restricted to tagged merchandise when used for assortment analysis, because service and adjustment codes should not be treated as standard products.

## Supporting documentation

- [Business problem and KPI definitions](docs/business_problem.md)
- [Data dictionary](docs/data_dictionary.md)
- [Dashboard and Power BI specification](docs/dashboard_specification.md)
- [Validation approach](docs/validation.md)
- [Evidence-based insights](docs/generated_insights.md)

---

Built as a portfolio project to demonstrate job-relevant Data Analyst skills across Excel, SQL, Python, and Power BI.
