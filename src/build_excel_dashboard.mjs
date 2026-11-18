import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const processedDir = path.join(projectRoot, "data", "processed");
const excelDir = path.join(projectRoot, "excel");
const workDir = path.join(projectRoot, "work", "excel_previews");
const font = "Arial";
const palette = {
  navy: "#183B56",
  teal: "#087E8B",
  coral: "#FF5A5F",
  gold: "#F6AA1C",
  blue: "#3D5A80",
  ink: "#172B4D",
  muted: "#60758A",
  light: "#F7F9FC",
  line: "#D9E2EC",
  paleTeal: "#E7F5F4",
  paleCoral: "#FFF0F0",
  paleGold: "#FFF8E7",
  paleBlue: "#EDF2F7",
};

const headerLabels = {
  line_id: "Line ID",
  invoice_key: "Order key",
  invoice_no: "Invoice no.",
  stock_code: "Stock code",
  description: "Description",
  quantity: "Quantity",
  invoice_date: "Invoice date",
  transaction_date: "Transaction date",
  unit_price: "Unit price",
  customer_id: "Customer ID",
  country: "Country",
  sales_amount: "Sales amount",
  year_month: "Month",
  year: "Year",
  month_number: "Month number",
  weekday: "Weekday",
  hour: "Hour",
  is_merchandise: "Merchandise",
  revenue: "Revenue",
  orders: "Orders",
  units_sold: "Units sold",
  known_customers: "Known customers",
  average_order_value: "Average order value",
  revenue_mom_pct: "Revenue MoM %",
  is_partial_month: "Partial month?",
  revenue_share_pct: "Revenue share %",
  revenue_rank: "Revenue rank",
  customers: "Customers",
  customer_share_pct: "Customer share %",
  first_purchase: "First purchase",
  last_purchase: "Last purchase",
  recency_days: "Recency days",
  frequency_score: "Frequency score",
  monetary_score: "Monetary score",
  recency_score: "Recency score",
  segment: "Segment",
  metric: "Metric",
  value: "Value",
  definition: "Definition",
  check: "Check",
  passed: "Passed",
  status: "Status",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));
}

async function readCsv(fileName, numericColumns = []) {
  const filePath = path.join(processedDir, fileName);
  const text = await fs.readFile(filePath, "utf8");
  const numeric = new Set(numericColumns);
  return parseCsv(text).map((row) => {
    const result = {};
    for (const [key, value] of Object.entries(row)) {
      result[key] = numeric.has(key) && value !== "" ? Number(value) : value;
    }
    return result;
  });
}

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function setSheetBase(sheet, tabColor) {
  sheet.showGridLines = false;
  sheet.tabColor = tabColor;
  sheet.getRange("A1:Z250").format.font = { name: font, size: 10, color: palette.ink };
  sheet.getRange("A1:Z250").format.verticalAlignment = "center";
}

function setTitle(sheet, title, subtitle = "") {
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format.font = { name: font, size: 16, bold: true, color: palette.ink };
  sheet.getRange("A1").format.rowHeight = 26;
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format.font = { name: font, size: 10, italic: true, color: palette.muted };
  sheet.getRange("A3:Q3").format.borders = { bottom: { style: "thin", color: palette.line } };
}

function formatHeader(range) {
  range.format = {
    fill: palette.navy,
    font: { name: font, size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  range.format.rowHeight = 26;
}

function addTable(sheet, startRow, startCol, headers, rows, name, formats = {}) {
  const matrix = [headers.map((header) => headerLabels[header] ?? header), ...rows.map((row) => headers.map((header) => row[header] ?? null))];
  const start = `${columnName(startCol)}${startRow}`;
  const end = `${columnName(startCol + headers.length - 1)}${startRow + rows.length}`;
  sheet.getRange(`${start}:${end}`).values = matrix;
  formatHeader(sheet.getRange(`${columnName(startCol)}${startRow}:${columnName(startCol + headers.length - 1)}${startRow}`));
  const body = sheet.getRange(`${columnName(startCol)}${startRow + 1}:${columnName(startCol + headers.length - 1)}${startRow + rows.length}`);
  body.format.borders = { insideHorizontal: { style: "thin", color: palette.line } };
  body.format.rowHeight = 18;
  for (const [header, numberFormat] of Object.entries(formats)) {
    const offset = headers.indexOf(header);
    if (offset >= 0 && rows.length > 0) {
      sheet.getRange(`${columnName(startCol + offset)}${startRow + 1}:${columnName(startCol + offset)}${startRow + rows.length}`).format.numberFormat = numberFormat;
    }
  }
  const table = sheet.tables.add(`${start}:${end}`, true, name);
  table.showBandedColumns = false;
  return { startRow, endRow: startRow + rows.length, startCol, endCol: startCol + headers.length - 1 };
}

function setWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

function addKpiCard(sheet, labelCell, valueCell, label, formula, numberFormat, fill) {
  const labelColumn = labelCell.replace(/[0-9]/g, "");
  const labelRow = labelCell.replace(/[^0-9]/g, "");
  const valueRow = valueCell.replace(/[^0-9]/g, "");
  const endColumn = columnName(labelColumn.charCodeAt(0) - 64 + 1);
  sheet.getRange(`${labelColumn}${labelRow}:${endColumn}${valueRow}`).format = {
    fill,
    borders: { preset: "outside", style: "thin", color: palette.line },
  };
  sheet.getRange(labelCell).values = [[label]];
  sheet.getRange(labelCell).format.font = { name: font, size: 9, bold: true, color: palette.muted };
  sheet.getRange(valueCell).formulas = [[formula]];
  sheet.getRange(valueCell).format.font = { name: font, size: 14, bold: true, color: palette.ink };
  sheet.getRange(valueCell).format.numberFormat = numberFormat;
}

function decorateChart(chart, title, positionStart, positionEnd, color, valueFormat, hasLegend = false) {
  chart.title = title;
  chart.titleTextStyle.typeface = font;
  chart.titleTextStyle.fontSize = 12;
  chart.hasLegend = hasLegend;
  chart.xAxis = { axisType: "textAxis", textStyle: { typeface: font, fontSize: 9 } };
  chart.yAxis = { numberFormatCode: valueFormat, numberFormatSourceLinked: false, textStyle: { typeface: font, fontSize: 9 } };
  chart.setPosition(positionStart, positionEnd);
  if (chart.series.items.length > 0) {
    chart.series.items[0].fill = color;
    chart.series.items[0].line = { fill: color, style: "solid", width: 2 };
  }
}

function safeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function main() {
  const [monthly, countries, products, segments, customers, quality, validations, sample] = await Promise.all([
    readCsv("dashboard_monthly_kpis.csv", ["revenue", "orders", "units_sold", "known_customers", "average_order_value", "revenue_mom_pct"]),
    readCsv("dashboard_country_performance.csv", ["revenue", "orders", "units_sold", "known_customers", "average_order_value", "revenue_share_pct", "revenue_rank"]),
    readCsv("dashboard_product_performance.csv", ["revenue", "units_sold", "orders", "known_customers", "revenue_share_pct", "revenue_rank"]),
    readCsv("dashboard_customer_segments.csv", ["customers", "revenue", "orders", "customer_share_pct", "revenue_share_pct"]),
    readCsv("customer_rfm.csv", ["orders", "revenue", "units_sold", "recency_days", "average_order_value", "frequency_score", "monetary_score", "recency_score"]),
    readCsv("data_quality_report.csv", ["value"]),
    readCsv("validation_results.csv", []),
    readCsv("excel_fact_sample.csv", ["line_id", "quantity", "unit_price", "sales_amount", "hour"]),
  ]);

  if (monthly.length === 0 || countries.length === 0 || products.length === 0) {
    throw new Error("Analysis outputs are empty. Run src/analysis.py before building the workbook.");
  }
  const internationalCountries = countries.filter((row) => row.country !== "United Kingdom").slice(0, 10);

  const workbook = Workbook.create();
  const dashboard = workbook.worksheets.add("Dashboard");
  const monthlySheet = workbook.worksheets.add("Monthly KPIs");
  const countrySheet = workbook.worksheets.add("Countries");
  const productSheet = workbook.worksheets.add("Products");
  const customerSheet = workbook.worksheets.add("Customers");
  const qualitySheet = workbook.worksheets.add("Data Quality");
  const sampleSheet = workbook.worksheets.add("Fact Sample");
  const readMeSheet = workbook.worksheets.add("Read Me");

  setSheetBase(dashboard, palette.navy);
  setSheetBase(monthlySheet, palette.teal);
  setSheetBase(countrySheet, palette.coral);
  setSheetBase(productSheet, palette.gold);
  setSheetBase(customerSheet, palette.blue);
  setSheetBase(qualitySheet, "#7D8B99");
  setSheetBase(sampleSheet, "#A6B6C7");
  setSheetBase(readMeSheet, "#9B8EA4");

  setTitle(monthlySheet, "Monthly KPIs", "Completed sales only. The final source month is flagged when it is incomplete.");
  const monthlyBlock = addTable(
    monthlySheet,
    4,
    1,
    ["year_month", "revenue", "orders", "units_sold", "known_customers", "average_order_value", "revenue_mom_pct", "is_partial_month"],
    monthly,
    "MonthlyKpisTable",
    { revenue: "#,##0.00", orders: "#,##0", units_sold: "#,##0", known_customers: "#,##0", average_order_value: "#,##0.00", revenue_mom_pct: "0.0\"%\"" },
  );
  setWidths(monthlySheet, { A: 13, B: 15, C: 11, D: 13, E: 16, F: 18, G: 14, H: 15 });
  monthlySheet.freezePanes.freezeRows(4);

  setTitle(countrySheet, "Country Performance", "Sorted by completed-sales revenue.");
  const countryBlock = addTable(
    countrySheet,
    4,
    1,
    ["country", "revenue", "orders", "units_sold", "known_customers", "average_order_value", "revenue_share_pct", "revenue_rank"],
    countries,
    "CountryPerformanceTable",
    { revenue: "#,##0.00", orders: "#,##0", units_sold: "#,##0", known_customers: "#,##0", average_order_value: "#,##0.00", revenue_share_pct: "0.0\"%\"", revenue_rank: "#,##0" },
  );
  setWidths(countrySheet, { A: 24, B: 15, C: 11, D: 13, E: 16, F: 18, G: 16, H: 13 });
  countrySheet.freezePanes.freezeRows(4);

  setTitle(productSheet, "Merchandise Performance", "Service and adjustment codes are excluded from the merchandise ranking.");
  const productBlock = addTable(
    productSheet,
    4,
    1,
    ["stock_code", "description", "revenue", "units_sold", "orders", "known_customers", "revenue_share_pct", "revenue_rank"],
    products,
    "ProductPerformanceTable",
    { revenue: "#,##0.00", units_sold: "#,##0", orders: "#,##0", known_customers: "#,##0", revenue_share_pct: "0.0\"%\"", revenue_rank: "#,##0" },
  );
  setWidths(productSheet, { A: 14, B: 42, C: 15, D: 13, E: 11, F: 16, G: 16, H: 13 });
  productSheet.freezePanes.freezeRows(4);

  setTitle(customerSheet, "Customer Segments", "RFM segmentation uses known customers only; source rows without customer ID remain in sales KPIs.");
  const segmentBlock = addTable(
    customerSheet,
    4,
    1,
    ["segment", "customers", "revenue", "orders", "customer_share_pct", "revenue_share_pct"],
    segments,
    "CustomerSegmentsTable",
    { customers: "#,##0", revenue: "#,##0.00", orders: "#,##0", customer_share_pct: "0.0\"%\"", revenue_share_pct: "0.0\"%\"" },
  );
  customerSheet.getRange("A13").values = [["Customer-level RFM detail"]];
  customerSheet.getRange("A13").format.font = { name: font, size: 12, bold: true, color: palette.ink };
  const customerBlock = addTable(
    customerSheet,
    15,
    1,
    ["customer_id", "first_purchase", "last_purchase", "orders", "revenue", "units_sold", "recency_days", "average_order_value", "frequency_score", "monetary_score", "recency_score", "segment"],
    customers,
    "CustomerRfmTable",
    { orders: "#,##0", revenue: "#,##0.00", units_sold: "#,##0", recency_days: "#,##0", average_order_value: "#,##0.00", frequency_score: "0", monetary_score: "0", recency_score: "0" },
  );
  setWidths(customerSheet, { A: 14, B: 14, C: 14, D: 10, E: 15, F: 12, G: 13, H: 18, I: 15, J: 15, K: 13, L: 20 });
  customerSheet.freezePanes.freezeRows(4);

  setTitle(qualitySheet, "Data Quality and Validation", "Cleaning decisions and independent reconciliations for the published KPI population.");
  const qualityBlock = addTable(qualitySheet, 4, 1, ["metric", "value", "definition"], quality, "QualityReportTable", { value: "#,##0" });
  const validationStart = qualityBlock.endRow + 4;
  qualitySheet.getRange(`A${validationStart - 2}`).values = [["Validation results"]];
  qualitySheet.getRange(`A${validationStart - 2}`).format.font = { name: font, size: 12, bold: true, color: palette.ink };
  addTable(qualitySheet, validationStart, 1, ["check", "passed", "definition", "status"], validations, "ValidationResultsTable");
  setWidths(qualitySheet, { A: 34, B: 14, C: 62, D: 12 });
  qualitySheet.freezePanes.freezeRows(4);

  setTitle(sampleSheet, "Fact Sales Sample", "A reproducible 5,000-row sample for Excel exploration. The full clean fact table is in data/processed.");
  sampleSheet.getRange("A3").values = [["Source: UCI Machine Learning Repository, Online Retail II, CC BY 4.0, https://archive.ics.uci.edu/dataset/502/online+retail+ii"]];
  sampleSheet.getRange("A3").format.font = { name: font, size: 9, italic: true, color: palette.muted };
  const sampleHeaders = ["line_id", "invoice_key", "invoice_no", "stock_code", "description", "quantity", "invoice_date", "unit_price", "customer_id", "country", "sales_amount", "year_month", "weekday", "hour", "is_merchandise"];
  addTable(sampleSheet, 5, 1, sampleHeaders, sample, "FactSampleTable", { line_id: "#,##0", quantity: "#,##0", unit_price: "#,##0.00", sales_amount: "#,##0.00", hour: "0" });
  setWidths(sampleSheet, { A: 10, B: 26, C: 12, D: 14, E: 42, F: 10, G: 20, H: 12, I: 14, J: 22, K: 14, L: 13, M: 13, N: 9, O: 15 });
  sampleSheet.freezePanes.freezeRows(5);

  setTitle(readMeSheet, "Project Notes", "Use the prepared CSV files for Power BI or the native Excel dashboard for quick review.");
  readMeSheet.getRange("A4:B10").values = [
    ["Topic", "Notes"],
    ["Source", "UCI Online Retail II, anonymized non-store retail transactions from December 2009 to December 2011."],
    ["Sales population", "Positive completed sale lines after removal of exact duplicates, cancellations, invalid invoices/dates, and non-positive quantity or price rows."],
    ["Customer scope", "Rows without customer IDs remain in sales KPIs but are excluded from customer-level RFM metrics."],
    ["Refresh", "Run the Python analysis pipeline before rebuilding the workbook so source-to-dashboard calculations remain reproducible."],
    ["Power BI", "Use dashboard_fact_sales.csv with the measures in docs/dashboard_specification.md. Do not relate pre-aggregated CSVs back to the fact table."],
    ["Limitation", "The dataset has no margin, inventory, marketing cost, or web-session data. Revenue is not profit."],
  ];
  formatHeader(readMeSheet.getRange("A4:B4"));
  readMeSheet.getRange("A5:B10").format.wrapText = true;
  readMeSheet.getRange("A5:B10").format.verticalAlignment = "top";
  readMeSheet.getRange("A5:B10").format.borders = { insideHorizontal: { style: "thin", color: palette.line } };
  readMeSheet.getRange("A5:A10").format.font = { name: font, size: 10, bold: true, color: palette.ink };
  readMeSheet.getRange("A5:B10").format.rowHeight = 34;
  setWidths(readMeSheet, { A: 20, B: 95 });

  setTitle(dashboard, "Online Retail Sales Dashboard", "Completed sales only. Monetary values use the source dataset's price units.");
  dashboard.getRange("A4").values = [[`Data period: ${monthly[0].year_month} to ${monthly[monthly.length - 1].year_month}`]];
  dashboard.getRange("A4").format.font = { name: font, size: 9, italic: true, color: palette.muted };

  const monthlyEndRow = monthlyBlock.endRow;
  const segmentEndRow = segmentBlock.endRow;
  addKpiCard(dashboard, "A5", "A6", "Total revenue", `=SUM('Monthly KPIs'!$B$5:$B$${monthlyEndRow})`, "#,##0.00", palette.paleTeal);
  addKpiCard(dashboard, "C5", "C6", "Orders", `=SUM('Monthly KPIs'!$C$5:$C$${monthlyEndRow})`, "#,##0", palette.paleBlue);
  addKpiCard(dashboard, "E5", "E6", "Average order value", "=A6/C6", "#,##0.00", palette.paleGold);
  addKpiCard(dashboard, "G5", "G6", "Known customers", `=SUM('Customers'!$B$5:$B$${segmentEndRow})`, "#,##0", palette.paleCoral);
  addKpiCard(dashboard, "I5", "I6", "Units sold", `=SUM('Monthly KPIs'!$D$5:$D$${monthlyEndRow})`, "#,##0", palette.paleTeal);
  setWidths(dashboard, { A: 17, B: 4, C: 15, D: 4, E: 19, F: 4, G: 18, H: 4, I: 16, J: 4, K: 2, L: 15, M: 15, N: 2, O: 20, P: 15, Q: 2, R: 24, S: 15, T: 2, U: 20, V: 15 });

  const helperStartRow = 60;
  dashboard.getRange(`L${helperStartRow}:M${helperStartRow}`).values = [["Month", "Revenue"]];
  dashboard.getRange(`O${helperStartRow}:P${helperStartRow}`).values = [["Country", "Revenue"]];
  dashboard.getRange(`R${helperStartRow}:S${helperStartRow}`).values = [["Product", "Revenue"]];
  dashboard.getRange(`U${helperStartRow}:V${helperStartRow}`).values = [["Segment", "Customers"]];
  for (let i = 0; i < monthly.length; i += 1) {
    const sourceRow = monthlyBlock.startRow + 1 + i;
    const targetRow = helperStartRow + 1 + i;
    dashboard.getRange(`L${targetRow}:M${targetRow}`).formulas = [[`='Monthly KPIs'!A${sourceRow}`, `='Monthly KPIs'!B${sourceRow}`]];
  }
  for (let i = 0; i < internationalCountries.length; i += 1) {
    const sourceRow = countryBlock.startRow + 1 + countries.findIndex((row) => row.country === internationalCountries[i].country);
    const targetRow = helperStartRow + 1 + i;
    dashboard.getRange(`O${targetRow}:P${targetRow}`).formulas = [[`='Countries'!A${sourceRow}`, `='Countries'!B${sourceRow}`]];
  }
  for (let i = 0; i < Math.min(10, products.length); i += 1) {
    const sourceRow = productBlock.startRow + 1 + i;
    const targetRow = helperStartRow + 1 + i;
    dashboard.getRange(`R${targetRow}:S${targetRow}`).formulas = [[`=LEFT('Products'!B${sourceRow},32)`, `='Products'!C${sourceRow}`]];
  }
  for (let i = 0; i < segments.length; i += 1) {
    const sourceRow = segmentBlock.startRow + 1 + i;
    const targetRow = helperStartRow + 1 + i;
    dashboard.getRange(`U${targetRow}:V${targetRow}`).formulas = [[`='Customers'!A${sourceRow}`, `='Customers'!B${sourceRow}`]];
  }
  formatHeader(dashboard.getRange(`L${helperStartRow}:M${helperStartRow}`));
  formatHeader(dashboard.getRange(`O${helperStartRow}:P${helperStartRow}`));
  formatHeader(dashboard.getRange(`R${helperStartRow}:S${helperStartRow}`));
  formatHeader(dashboard.getRange(`U${helperStartRow}:V${helperStartRow}`));
  dashboard.getRange(`M${helperStartRow + 1}:M${helperStartRow + monthly.length}`).format.numberFormat = "#,##0.00";
  dashboard.getRange(`P${helperStartRow + 1}:P${helperStartRow + internationalCountries.length}`).format.numberFormat = "#,##0.00";
  dashboard.getRange(`S${helperStartRow + 1}:S${helperStartRow + Math.min(10, products.length)}`).format.numberFormat = "#,##0.00";
  dashboard.getRange(`V${helperStartRow + 1}:V${helperStartRow + segments.length}`).format.numberFormat = "#,##0";

  const monthlyChart = dashboard.charts.add("line", dashboard.getRange(`L${helperStartRow}:M${helperStartRow + monthly.length}`));
  decorateChart(monthlyChart, "Monthly revenue", "A9", "I24", palette.teal, "#,##0");
  const countryChart = dashboard.charts.add("bar", dashboard.getRange(`O${helperStartRow}:P${helperStartRow + internationalCountries.length}`));
  decorateChart(countryChart, "Top non-UK countries by revenue", "J9", "Q24", palette.coral, "#,##0");
  const productChart = dashboard.charts.add("bar", dashboard.getRange(`R${helperStartRow}:S${helperStartRow + Math.min(10, products.length)}`));
  decorateChart(productChart, "Top merchandise by revenue", "A26", "I42", palette.gold, "#,##0");
  const segmentChart = dashboard.charts.add("doughnut", dashboard.getRange(`U${helperStartRow}:V${helperStartRow + segments.length}`));
  segmentChart.title = "Known customers by segment";
  segmentChart.titleTextStyle.typeface = font;
  segmentChart.titleTextStyle.fontSize = 12;
  segmentChart.hasLegend = true;
  segmentChart.legend = { position: "right", textStyle: { typeface: font, fontSize: 9 } };
  segmentChart.setPosition("J26", "Q42");

  workbook.recalculate();
  const check = await workbook.inspect({
    kind: "table",
    range: "Dashboard!A1:J8",
    include: "values,formulas",
    tableMaxRows: 12,
    tableMaxCols: 12,
  });
  console.log(check.ndjson);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
    options: { useRegex: true, maxResults: 100 },
    summary: "final formula error scan",
  });
  console.log(errors.ndjson);

  await fs.mkdir(excelDir, { recursive: true });
  await fs.mkdir(workDir, { recursive: true });
  const previewSheets = [
    ["Dashboard", "A1:Q42"],
    ["Monthly KPIs", "A1:H32"],
    ["Countries", "A1:H25"],
    ["Products", "A1:H25"],
    ["Customers", "A1:L27"],
    ["Data Quality", "A1:D30"],
    ["Fact Sample", "A1:O26"],
    ["Read Me", "A1:B10"],
  ];
  for (const [sheetName, range] of previewSheets) {
    const preview = await workbook.render({ sheetName, range, scale: 0.8, format: "png" });
    await fs.writeFile(path.join(workDir, `${safeFileName(sheetName)}.png`), new Uint8Array(await preview.arrayBuffer()));
  }

  const output = await SpreadsheetFile.exportXlsx(workbook);
  const outputPath = path.join(excelDir, "Online_Retail_Analysis.xlsx");
  await output.save(outputPath);
  console.log(`Workbook written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
