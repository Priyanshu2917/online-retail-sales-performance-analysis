-- SQLite schema mirrored by src/analysis.py. The Python pipeline also loads these tables.

CREATE TABLE IF NOT EXISTS sales_clean (
    line_id INTEGER PRIMARY KEY,
    source_sheet TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    invoice_key TEXT NOT NULL,
    stock_code TEXT,
    description TEXT,
    quantity REAL NOT NULL CHECK (quantity > 0),
    invoice_date TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    unit_price REAL NOT NULL CHECK (unit_price > 0),
    customer_id TEXT,
    country TEXT NOT NULL,
    sales_amount REAL NOT NULL,
    year_month TEXT NOT NULL,
    year INTEGER NOT NULL,
    month_number INTEGER NOT NULL,
    weekday TEXT NOT NULL,
    hour INTEGER NOT NULL,
    is_merchandise INTEGER NOT NULL,
    is_cancellation INTEGER NOT NULL CHECK (is_cancellation = 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_clean_invoice_key ON sales_clean(invoice_key);
CREATE INDEX IF NOT EXISTS idx_sales_clean_year_month ON sales_clean(year_month);
CREATE INDEX IF NOT EXISTS idx_sales_clean_country ON sales_clean(country);
CREATE INDEX IF NOT EXISTS idx_sales_clean_customer ON sales_clean(customer_id);
