# Data Dictionary

## Source fields

| Field | Meaning | Treatment |
|---|---|---|
| Invoice | Transaction invoice identifier | Renamed to `invoice_no`; invoices beginning with `C` are classified as cancellations. |
| StockCode | Product or service identifier | Renamed to `stock_code`; selected service codes are tagged as non-merchandise. |
| Description | Item description | Preserved; missing values become `Unknown item`. |
| Quantity | Number of units | Converted to numeric; positive values only enter the fact table. |
| InvoiceDate | Transaction date and time | Parsed as a datetime and used to derive month, weekday, and hour. |
| Price | Unit price | Renamed to `unit_price`; positive values only enter the fact table. |
| Customer ID | Anonymized customer identifier | Standardized as a nullable string. |
| Country | Customer country | Standardized as text. |

## Derived fields

| Field | Definition |
|---|---|
| line_id | Sequential identifier created after cleaning. |
| invoice_key | Source sheet plus invoice number, used as the order key. |
| sales_amount | `quantity * unit_price`. |
| transaction_date | Date portion of the invoice timestamp. |
| year_month | Calendar month in `YYYY-MM` form. |
| is_merchandise | False for tagged service or adjustment stock codes. |
| recency_score, frequency_score, monetary_score | Deterministic quintile scores used in RFM segmentation. |
| segment | Customer group derived from RFM scores. |

## Important interpretation note

The source does not provide an explicit currency label, product cost, gross margin, marketing cost, or inventory position. Monetary metrics are reported in the source's price units. Do not interpret revenue as profit.
