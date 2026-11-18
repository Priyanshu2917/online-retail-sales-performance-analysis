"""Reproducible analysis pipeline for the Online Retail II portfolio project."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPECIAL_STOCK_CODES = {"POST", "DOT", "M", "BANK CHARGES", "C2", "D", "S", "PADS"}
SEGMENT_ORDER = ["Champions", "Loyal Customers", "At Risk", "New Customers", "Potential", "Needs Attention"]


def output_paths(project_root: Path) -> dict[str, Path]:
    processed = project_root / "data" / "processed"
    docs = project_root / "docs"
    for directory in (processed, docs):
        directory.mkdir(parents=True, exist_ok=True)
    return {"processed": processed, "docs": docs}


def normalise_source(source_path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load both source sheets, standardise fields, and retain source provenance."""
    sheets = pd.read_excel(source_path, sheet_name=None, engine="openpyxl")
    frames: list[pd.DataFrame] = []
    load_log: list[dict[str, object]] = []

    for sheet_name, frame in sheets.items():
        frame = frame.copy()
        frame["source_sheet"] = sheet_name
        frames.append(frame)
        load_log.append({"source_sheet": sheet_name, "raw_rows": int(len(frame))})

    data = pd.concat(frames, ignore_index=True)
    expected = {
        "Invoice": "invoice_no",
        "StockCode": "stock_code",
        "Description": "description",
        "Quantity": "quantity",
        "InvoiceDate": "invoice_date",
        "Price": "unit_price",
        "Customer ID": "customer_id",
        "Country": "country",
    }
    missing_columns = sorted(set(expected).difference(data.columns))
    if missing_columns:
        raise ValueError(f"Unexpected source schema. Missing columns: {missing_columns}")

    data = data.rename(columns=expected)[["source_sheet", *expected.values()]].copy()
    data["invoice_no"] = (
        data["invoice_no"].astype("string").str.strip().str.replace(r"\\.0$", "", regex=True)
    )
    data["stock_code"] = data["stock_code"].astype("string").str.strip()
    data["description"] = data["description"].astype("string").str.strip().fillna("Unknown item")
    data["country"] = data["country"].astype("string").str.strip().fillna("Unknown")
    data["quantity"] = pd.to_numeric(data["quantity"], errors="coerce")
    data["unit_price"] = pd.to_numeric(data["unit_price"], errors="coerce")
    data["invoice_date"] = pd.to_datetime(data["invoice_date"], errors="coerce")
    customer_numeric = pd.to_numeric(data["customer_id"], errors="coerce")
    data["customer_id"] = customer_numeric.astype("Int64").astype("string")
    return data, pd.DataFrame(load_log)


def clean_transactions(raw: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Create a positive, completed-sales fact table and a transparent quality report."""
    duplicate_columns = [
        "invoice_no",
        "stock_code",
        "description",
        "quantity",
        "invoice_date",
        "unit_price",
        "customer_id",
        "country",
    ]
    duplicate_mask = raw.duplicated(subset=duplicate_columns, keep="first")
    deduplicated = raw.loc[~duplicate_mask].copy()

    blank_invoice = deduplicated["invoice_no"].isna() | deduplicated["invoice_no"].str.len().fillna(0).eq(0)
    invalid_date = deduplicated["invoice_date"].isna()
    cancellation = deduplicated["invoice_no"].str.upper().str.startswith("C", na=False)
    nonpositive_quantity = deduplicated["quantity"].isna() | deduplicated["quantity"].le(0)
    nonpositive_unit_price = deduplicated["unit_price"].isna() | deduplicated["unit_price"].le(0)

    valid_fact = ~(blank_invoice | invalid_date | cancellation | nonpositive_quantity | nonpositive_unit_price)
    facts = deduplicated.loc[valid_fact].copy()
    facts["line_id"] = np.arange(1, len(facts) + 1, dtype=np.int64)
    facts["invoice_key"] = facts["source_sheet"].astype(str) + "-" + facts["invoice_no"].astype(str)
    facts["sales_amount"] = facts["quantity"] * facts["unit_price"]
    facts["transaction_date"] = facts["invoice_date"].dt.normalize()
    facts["year_month"] = facts["invoice_date"].dt.to_period("M").astype(str)
    facts["year"] = facts["invoice_date"].dt.year.astype("int64")
    facts["month_number"] = facts["invoice_date"].dt.month.astype("int64")
    facts["weekday"] = facts["invoice_date"].dt.day_name()
    facts["hour"] = facts["invoice_date"].dt.hour.astype("int64")
    facts["is_merchandise"] = ~facts["stock_code"].isin(SPECIAL_STOCK_CODES)
    facts["is_cancellation"] = False

    report_rows = [
        ("Raw source rows", int(len(raw)), "All rows loaded from both supplied source sheets."),
        ("Exact duplicate rows removed", int(duplicate_mask.sum()), "Duplicate definition excludes source sheet name."),
        ("Rows after duplicate removal", int(len(deduplicated)), "Population evaluated by the cleaning rules."),
        ("Cancellation rows excluded", int(cancellation.sum()), "Invoice number begins with C. Counts can overlap other exclusion flags."),
        ("Missing invoice rows excluded", int(blank_invoice.sum()), "A completed order needs an invoice identifier."),
        ("Missing/invalid date rows excluded", int(invalid_date.sum()), "A dated transaction is required for trend analysis."),
        ("Non-positive quantity rows excluded", int(nonpositive_quantity.sum()), "Returns and zero-quantity rows are not positive sales."),
        ("Non-positive price rows excluded", int(nonpositive_unit_price.sum()), "Free or adjustment rows are outside sales revenue."),
        ("Positive completed sales rows", int(len(facts)), "Clean fact-table population used for all commercial KPIs."),
        ("Rows without customer ID retained", int(facts["customer_id"].isna().sum()), "Retained for revenue and orders; excluded from customer-level metrics."),
    ]
    quality = pd.DataFrame(report_rows, columns=["metric", "value", "definition"])
    return facts, quality


def summarise_sales(facts: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Build KPI, geography, product, and customer outputs from the cleaned fact table."""
    monthly = (
        facts.groupby("year_month", as_index=False)
        .agg(
            revenue=("sales_amount", "sum"),
            orders=("invoice_key", "nunique"),
            units_sold=("quantity", "sum"),
            known_customers=("customer_id", "nunique"),
        )
        .sort_values("year_month")
        .reset_index(drop=True)
    )
    monthly["average_order_value"] = monthly["revenue"] / monthly["orders"]
    monthly["revenue_mom_pct"] = monthly["revenue"].pct_change() * 100
    monthly["is_partial_month"] = monthly["year_month"].eq(facts["year_month"].max()) & (
        facts["invoice_date"].max().day < facts["invoice_date"].max().days_in_month
    )

    total_revenue = facts["sales_amount"].sum()
    country = (
        facts.groupby("country", as_index=False)
        .agg(
            revenue=("sales_amount", "sum"),
            orders=("invoice_key", "nunique"),
            units_sold=("quantity", "sum"),
            known_customers=("customer_id", "nunique"),
        )
        .sort_values("revenue", ascending=False)
        .reset_index(drop=True)
    )
    country["average_order_value"] = country["revenue"] / country["orders"]
    country["revenue_share_pct"] = country["revenue"] / total_revenue * 100
    country["revenue_rank"] = np.arange(1, len(country) + 1, dtype=np.int64)

    merchandise = facts.loc[facts["is_merchandise"]].copy()
    product = (
        merchandise.groupby(["stock_code", "description"], as_index=False)
        .agg(
            revenue=("sales_amount", "sum"),
            units_sold=("quantity", "sum"),
            orders=("invoice_key", "nunique"),
            known_customers=("customer_id", "nunique"),
        )
        .sort_values("revenue", ascending=False)
        .reset_index(drop=True)
    )
    product["revenue_share_pct"] = product["revenue"] / merchandise["sales_amount"].sum() * 100
    product["revenue_rank"] = np.arange(1, len(product) + 1, dtype=np.int64)

    known = facts.loc[facts["customer_id"].notna()].copy()
    as_of_date = known["transaction_date"].max() + pd.Timedelta(days=1)
    customer = (
        known.groupby("customer_id", as_index=False)
        .agg(
            first_purchase=("transaction_date", "min"),
            last_purchase=("transaction_date", "max"),
            orders=("invoice_key", "nunique"),
            revenue=("sales_amount", "sum"),
            units_sold=("quantity", "sum"),
        )
        .sort_values("revenue", ascending=False)
        .reset_index(drop=True)
    )
    customer["recency_days"] = (as_of_date - customer["last_purchase"]).dt.days.astype("int64")
    customer["average_order_value"] = customer["revenue"] / customer["orders"]
    customer["frequency_score"] = pd.qcut(
        customer["orders"].rank(method="first", ascending=True), q=5, labels=False
    ).astype("int64") + 1
    customer["monetary_score"] = pd.qcut(
        customer["revenue"].rank(method="first", ascending=True), q=5, labels=False
    ).astype("int64") + 1
    customer["recency_score"] = pd.qcut(
        customer["recency_days"].rank(method="first", ascending=False), q=5, labels=False
    ).astype("int64") + 1

    conditions = [
        (customer["recency_score"] >= 4) & (customer["frequency_score"] >= 4) & (customer["monetary_score"] >= 4),
        (customer["recency_score"] <= 2) & (customer["frequency_score"] >= 3),
        (customer["frequency_score"] >= 3) & (customer["monetary_score"] >= 3),
        (customer["recency_score"] >= 4) & (customer["frequency_score"] == 1),
        (customer["recency_score"] >= 4) & (customer["frequency_score"] <= 2),
    ]
    choices = ["Champions", "At Risk", "Loyal Customers", "New Customers", "Potential"]
    customer["segment"] = np.select(conditions, choices, default="Needs Attention")
    customer["segment"] = pd.Categorical(customer["segment"], categories=SEGMENT_ORDER, ordered=True)

    segments = (
        customer.groupby("segment", observed=False, as_index=False)
        .agg(customers=("customer_id", "nunique"), revenue=("revenue", "sum"), orders=("orders", "sum"))
        .sort_values("segment")
        .reset_index(drop=True)
    )
    segments["customer_share_pct"] = segments["customers"] / segments["customers"].sum() * 100
    segments["revenue_share_pct"] = segments["revenue"] / segments["revenue"].sum() * 100
    return monthly, country, product, customer, segments


def metric_table(facts: pd.DataFrame, customer: pd.DataFrame) -> pd.DataFrame:
    revenue = facts["sales_amount"].sum()
    orders = facts["invoice_key"].nunique()
    metrics = [
        ("Total revenue", revenue, "Sum of positive completed sales line amounts."),
        ("Orders", orders, "Distinct source-sheet invoice keys in the clean fact table."),
        ("Average order value", revenue / orders, "Total revenue divided by distinct orders."),
        ("Units sold", facts["quantity"].sum(), "Sum of positive item quantities."),
        ("Known customers", customer["customer_id"].nunique(), "Customers with a usable source customer ID."),
        ("Date range start", facts["transaction_date"].min().date().isoformat(), "First included transaction date."),
        ("Date range end", facts["transaction_date"].max().date().isoformat(), "Last included transaction date."),
    ]
    return pd.DataFrame(metrics, columns=["metric", "value", "definition"])


def write_database(destination: Path, facts: pd.DataFrame, monthly: pd.DataFrame, country: pd.DataFrame, product: pd.DataFrame, customer: pd.DataFrame, segments: pd.DataFrame, quality: pd.DataFrame) -> None:
    """Provide a portable SQLite database for testing the included SQL queries."""
    database_facts = facts.copy()
    for column in ["invoice_date", "transaction_date"]:
        database_facts[column] = database_facts[column].dt.strftime("%Y-%m-%d %H:%M:%S")
    database_facts["customer_id"] = database_facts["customer_id"].astype(object).where(database_facts["customer_id"].notna(), None)
    database_facts["is_merchandise"] = database_facts["is_merchandise"].astype(int)
    database_facts["is_cancellation"] = database_facts["is_cancellation"].astype(int)

    with sqlite3.connect(destination) as connection:
        database_facts.to_sql("sales_clean", connection, if_exists="replace", index=False, chunksize=50000)
        monthly.to_sql("monthly_kpis", connection, if_exists="replace", index=False)
        country.to_sql("country_performance", connection, if_exists="replace", index=False)
        product.to_sql("product_performance", connection, if_exists="replace", index=False)
        customer.to_sql("customer_rfm", connection, if_exists="replace", index=False)
        segments.to_sql("customer_segments", connection, if_exists="replace", index=False)
        quality.to_sql("data_quality", connection, if_exists="replace", index=False)
        connection.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_sales_clean_invoice_key ON sales_clean(invoice_key);
            CREATE INDEX IF NOT EXISTS idx_sales_clean_year_month ON sales_clean(year_month);
            CREATE INDEX IF NOT EXISTS idx_sales_clean_country ON sales_clean(country);
            CREATE INDEX IF NOT EXISTS idx_sales_clean_customer ON sales_clean(customer_id);
            """
        )


def write_insights(project_root: Path, facts: pd.DataFrame, monthly: pd.DataFrame, country: pd.DataFrame, product: pd.DataFrame, customer: pd.DataFrame, segments: pd.DataFrame) -> pd.DataFrame:
    """Write findings only after calculation, so narrative never gets ahead of evidence."""
    total_revenue = facts["sales_amount"].sum()
    uk_row = country.loc[country["country"].eq("United Kingdom")]
    uk_share = float(uk_row["revenue_share_pct"].iloc[0]) if not uk_row.empty else np.nan
    non_uk = country.loc[~country["country"].eq("United Kingdom")]
    top_non_uk = non_uk.iloc[0] if not non_uk.empty else None
    top_product = product.iloc[0]
    top_ten_share = float(product.head(10)["revenue"].sum() / product["revenue"].sum() * 100)
    at_risk = segments.loc[segments["segment"].astype(str).eq("At Risk")]
    at_risk_share = float(at_risk["revenue_share_pct"].iloc[0]) if not at_risk.empty else 0.0
    complete_months = monthly.loc[~monthly["is_partial_month"]].copy()
    peak_month = complete_months.loc[complete_months["revenue"].idxmax()] if not complete_months.empty else monthly.loc[monthly["revenue"].idxmax()]

    notes = [
        {
            "priority": 1,
            "recommendation": "Protect the core market",
            "evidence": f"United Kingdom revenue share is {uk_share:.1f}% of clean sales.",
            "business_action": "Track UK repeat demand and service levels because the revenue base is concentrated there.",
        },
        {
            "priority": 2,
            "recommendation": "Test the leading international market",
            "evidence": f"{top_non_uk['country']} is the highest-revenue non-UK market at {top_non_uk['revenue_share_pct']:.1f}% of clean sales.",
            "business_action": "Run a small, measurable retention or promotion test before expanding international spend.",
        },
        {
            "priority": 3,
            "recommendation": "Use merchandise concentration in planning",
            "evidence": f"The top 10 merchandise SKUs contribute {top_ten_share:.1f}% of merchandise revenue. The leading SKU is {top_product['stock_code']} ({top_product['description']}).",
            "business_action": "Review availability and replenishment for high-revenue SKUs, while avoiding decisions based on revenue alone.",
        },
        {
            "priority": 4,
            "recommendation": "Target lapsed high-frequency customers",
            "evidence": f"The RFM At Risk segment represents {at_risk_share:.1f}% of known-customer revenue. Peak complete-month revenue was {peak_month['year_month']}.",
            "business_action": "Test a win-back offer against a holdout group and measure incremental repeat orders.",
        },
    ]
    result = pd.DataFrame(notes)
    result.to_csv(project_root / "data" / "processed" / "dashboard_recommendations.csv", index=False)

    content = "# Evidence-Based Insights\n\n"
    content += "All figures below use the positive completed-sales fact table produced by `src/analysis.py`.\n\n"
    content += f"- Clean sales revenue: {total_revenue:,.2f}.\n"
    content += f"- The peak complete month was {peak_month['year_month']}. The final available month is treated as partial when the source ends before month-end.\n"
    for note in notes:
        content += f"- **{note['recommendation']}:** {note['evidence']} {note['business_action']}\n"
    (project_root / "docs" / "generated_insights.md").write_text(content, encoding="utf-8")
    return result


def validate_outputs(facts: pd.DataFrame, monthly: pd.DataFrame, country: pd.DataFrame, product: pd.DataFrame, customer: pd.DataFrame, segments: pd.DataFrame) -> pd.DataFrame:
    """Reconcile headline outputs independently and fail the run if an invariant breaks."""
    revenue = facts["sales_amount"].sum()
    merchandise_revenue = facts.loc[facts["is_merchandise"], "sales_amount"].sum()
    checks = [
        ("No cancelled sales in fact table", bool(~facts["is_cancellation"].any()), "Completed-sales fact table excludes cancellation invoices."),
        ("All quantities are positive", bool(facts["quantity"].gt(0).all()), "Fact table has no returns or zero quantities."),
        ("All unit prices are positive", bool(facts["unit_price"].gt(0).all()), "Fact table has no zero-price or negative-price lines."),
        ("Monthly revenue reconciles", bool(np.isclose(monthly["revenue"].sum(), revenue)), "Monthly totals equal fact-table revenue."),
        ("Country revenue reconciles", bool(np.isclose(country["revenue"].sum(), revenue)), "Country totals equal fact-table revenue."),
        ("Merchandise product revenue reconciles", bool(np.isclose(product["revenue"].sum(), merchandise_revenue)), "Product totals reconcile to tagged merchandise only."),
        ("Customer segment revenue reconciles", bool(np.isclose(segments["revenue"].sum(), customer["revenue"].sum())), "Segment totals equal known-customer revenue."),
        ("Order keys are populated", bool(facts["invoice_key"].notna().all()), "Every fact row maps to an order identifier."),
    ]
    validations = pd.DataFrame(checks, columns=["check", "passed", "definition"])
    validations["status"] = np.where(validations["passed"], "PASS", "FAIL")
    if not validations["passed"].all():
        failures = validations.loc[~validations["passed"], "check"].tolist()
        raise ValueError(f"Validation failed: {failures}")
    return validations


def run(source_path: Path, project_root: Path) -> None:
    if not source_path.exists():
        raise FileNotFoundError(
            f"Source file not found: {source_path}. Run src/download_data.py or pass --source with the workbook path."
        )
    paths = output_paths(project_root)
    raw, load_log = normalise_source(source_path)
    facts, quality = clean_transactions(raw)
    monthly, country, product, customer, segments = summarise_sales(facts)
    metrics = metric_table(facts, customer)
    recommendations = write_insights(project_root, facts, monthly, country, product, customer, segments)
    validations = validate_outputs(facts, monthly, country, product, customer, segments)

    processed = paths["processed"]
    facts.to_csv(processed / "online_retail_cleaned.csv", index=False, date_format="%Y-%m-%d %H:%M:%S")
    facts[
        [
            "line_id", "invoice_key", "invoice_no", "stock_code", "description", "quantity", "invoice_date",
            "unit_price", "customer_id", "country", "sales_amount", "transaction_date", "year_month", "weekday", "hour", "is_merchandise",
        ]
    ].to_csv(processed / "dashboard_fact_sales.csv", index=False, date_format="%Y-%m-%d %H:%M:%S")
    monthly.to_csv(processed / "dashboard_monthly_kpis.csv", index=False)
    country.to_csv(processed / "dashboard_country_performance.csv", index=False)
    product.to_csv(processed / "dashboard_product_performance.csv", index=False)
    customer.to_csv(processed / "customer_rfm.csv", index=False, date_format="%Y-%m-%d")
    segments.to_csv(processed / "dashboard_customer_segments.csv", index=False)
    quality.to_csv(processed / "data_quality_report.csv", index=False)
    validations.to_csv(processed / "validation_results.csv", index=False)
    metrics.to_csv(processed / "kpi_summary.csv", index=False)
    load_log.to_csv(processed / "source_load_log.csv", index=False)
    facts.sample(n=min(5000, len(facts)), random_state=42).sort_values("invoice_date").to_csv(
        processed / "excel_fact_sample.csv", index=False, date_format="%Y-%m-%d %H:%M:%S"
    )
    write_database(processed / "online_retail_analysis.sqlite", facts, monthly, country, product, customer, segments, quality)
    serialisable_metrics = {row.metric: row.value for row in metrics.itertuples(index=False)}
    serialisable_metrics["source_file"] = str(source_path.name)
    serialisable_metrics["clean_sales_rows"] = int(len(facts))
    serialisable_metrics["recommendation_count"] = int(len(recommendations))
    (processed / "summary_metrics.json").write_text(json.dumps(serialisable_metrics, indent=2, default=str), encoding="utf-8")
    print(f"Analysis complete. Clean sales rows: {len(facts):,}. Revenue: {facts['sales_amount'].sum():,.2f}.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean and analyse UCI Online Retail II data.")
    parser.add_argument(
        "--source",
        type=Path,
        default=PROJECT_ROOT / "data" / "raw" / "online_retail_II.xlsx",
        help="Path to the source Excel workbook.",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=PROJECT_ROOT,
        help="Project directory containing data, docs, and images folders.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.source.resolve(), args.project_root.resolve())
