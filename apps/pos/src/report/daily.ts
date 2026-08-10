import * as XLSX from "xlsx";
import {
  aggregateItemSales,
  computeStats,
  fmtMoney,
  fmtQtyUnit,
  localDateStr,
  PAYMENT_METHODS,
  toQty,
  toRM,
  type Credit,
  type Item,
  type Order,
} from "@yf/core";

/** Increment when HQ changes the stable workbook contract. */
export const DAILY_WORKBOOK_TEMPLATE_VERSION = 2;

// v2 sheet set (mirrors demo-output/hq-daily-4sheet-demo.xlsx):
//   Sales List — one row per sale, amount split into Cash/Credit columns
//   Today Sales — per-item totals (qty merged with unit) + payment breakdown
//   Fish Sales — one row per sale containing fish; qty is the ekor count
//   Sales Detail — every sale as its own block, voided ones marked
//   Credit — today's credit sales, then the full outstanding ledger
export const SALES_LIST_HEADERS = ["Name", "Date", "Inv No", "Pay Type", "Cash", "Credit"] as const;
export const TODAY_SALES_HEADERS = ["Item", "Unit Price (RM)", "Qty", "Amount (RM)"] as const;
export const FISH_SALES_HEADERS = ["Inv No", "Pay Type", "Cash", "Credit", "Fish Qty (Ekor)"] as const;
export const CREDIT_HEADERS = ["Date", "Inv No", "Name", "Amount (RM)"] as const;

const validOrders = (orders: Order[]): Order[] =>
  [...orders].filter((order) => order.voidedAt == null).sort((a, b) => a.ts - b.ts);

const isChicken = (name: string): boolean => /\b(ayam|chicken|hen|rooster)\b/i.test(name);

/**
 * Fish head count ("ekor") on an order. The catalogue's only tail-tracking
 * items are fish and chicken, so a non-chicken tail line counts as fish — this
 * survives renamed/deleted items because it reads the line snapshot only.
 */
const fishEkor = (order: Order): number => {
  let ekor = 0;
  for (const line of order.items) {
    if (line.tailCount > 0 && !isChicken(line.name)) ekor += line.tailCount;
  }
  return ekor;
};

/** Cash/Credit split: a Credit sale leaves Cash empty and vice versa. */
const cashCredit = (order: Order): [number | string, number | string] =>
  order.method === "Credit" ? ["", toRM(order.totalCents)] : [toRM(order.totalCents), ""];

function setFormulaOrZero(
  sheet: XLSX.WorkSheet,
  cell: string,
  column: string,
  firstDataRow: number,
  dataRows: number,
  format = "0.00",
): void {
  sheet[cell] = dataRows > 0
    ? { t: "n", f: `SUM(${column}${firstDataRow}:${column}${firstDataRow + dataRows - 1})`, z: format }
    : { t: "n", v: 0, z: format };
}

function setNumberFormat(
  sheet: XLSX.WorkSheet,
  column: number,
  firstRow: number,
  lastRow: number,
  format: string,
): void {
  for (let row = firstRow; row <= lastRow; row += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ c: column, r: row })];
    if (cell) cell.z = format;
  }
}

/** Sheet 1 — every sale on one row, amount split into Cash/Credit columns. */
function salesListSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = validOrders(orders);
  const rows: (string | number)[][] = sales.map((order) => {
    const [cash, credit] = cashCredit(order);
    return [
      order.method === "Credit" ? (order.creditorName ?? "") : "",
      order.businessDate,
      order.id,
      order.method,
      cash,
      credit,
    ];
  });
  const totalRow = sales.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...SALES_LIST_HEADERS],
    ...rows,
    ["TOTAL", "", "", "", 0, 0],
  ]);
  setFormulaOrZero(sheet, `E${totalRow}`, "E", 2, sales.length);
  setFormulaOrZero(sheet, `F${totalRow}`, "F", 2, sales.length);
  setNumberFormat(sheet, 4, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 5, 1, totalRow - 1, "0.00");
  sheet["!cols"] = [
    { wch: 24 }, { wch: 13 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];
  sheet["!autofilter"] = { ref: `A1:F${Math.max(1, sales.length + 1)}` };
  return sheet;
}

/** Sheet 2 — per-item totals (qty merged with its unit) + payment breakdown. */
function todaySalesSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = aggregateItemSales(orders);
  const stats = computeStats(orders, "today");
  const voided = orders.filter((order) => order.voidedAt != null);
  const rows: (string | number)[][] = [[...TODAY_SALES_HEADERS]];
  for (const sale of sales) {
    const qty = toQty(sale.qtyMilli);
    rows.push([
      sale.name,
      qty > 0 ? toRM(Math.round(sale.amountCents / qty)) : "",
      fmtQtyUnit(sale.qtyMilli, sale.unit),
      toRM(sale.amountCents),
    ]);
  }
  const totalRowIndex = rows.length + 1; // 1-based sheet row of the TOTAL line
  rows.push(["TOTAL", "", "", 0]);
  rows.push([]);
  rows.push(["BY PAYMENT"]);
  for (const method of PAYMENT_METHODS) {
    const bucket = stats.byMethod[method];
    if (bucket.count) rows.push([`${method} (${bucket.count})`, "", "", toRM(bucket.totalCents)]);
  }
  if (voided.length) {
    rows.push([
      `Voided: ${voided.length} sale(s)`,
      "",
      "",
      toRM(voided.reduce((sum, order) => sum + order.totalCents, 0)),
    ]);
  }
  rows.push([`${stats.count} sale(s), ${voided.length} voided`]);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  setFormulaOrZero(sheet, `D${totalRowIndex}`, "D", 2, sales.length);
  setNumberFormat(sheet, 1, 1, totalRowIndex - 1, "0.00");
  setNumberFormat(sheet, 3, 1, rows.length, "0.00");
  sheet["!cols"] = [{ wch: 26 }, { wch: 15 }, { wch: 13 }, { wch: 14 }];
  return sheet;
}

/** Sheet 3 — one row per sale containing fish; the qty column is ekor. */
function fishSalesSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = validOrders(orders).filter((order) => fishEkor(order) > 0);
  const rows: (string | number)[][] = sales.map((order) => {
    const [cash, credit] = cashCredit(order);
    return [order.id, order.method, cash, credit, fishEkor(order)];
  });
  const totalRow = sales.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...FISH_SALES_HEADERS],
    ...rows,
    ["TOTAL", "", 0, 0, 0],
  ]);
  setFormulaOrZero(sheet, `C${totalRow}`, "C", 2, sales.length);
  setFormulaOrZero(sheet, `D${totalRow}`, "D", 2, sales.length);
  setFormulaOrZero(sheet, `E${totalRow}`, "E", 2, sales.length, "0");
  setNumberFormat(sheet, 2, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 3, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 4, 1, totalRow - 1, "0");
  sheet["!cols"] = [{ wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  sheet["!autofilter"] = { ref: `A1:E${Math.max(1, sales.length + 1)}` };
  return sheet;
}

/** Sheet 4 — every sale (voided included, marked) as its own block. */
function salesDetailSheet(orders: Order[]): XLSX.WorkSheet {
  const all = [...orders].sort((a, b) => a.ts - b.ts);
  const rows: (string | number)[][] = [];
  for (const order of all) {
    const time = new Date(order.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const voided = order.voidedAt != null;
    rows.push([
      `Inv #${order.id}${order.creditorName ? ` — ${order.creditorName}` : ""}`,
      time,
      order.method,
      voided ? "VOIDED" : "",
    ]);
    rows.push(["Item", "Qty", "Price (RM)", "Amount (RM)"]);
    for (const line of order.items) {
      rows.push([
        line.tailCount && line.unit !== "each" ? `${line.name} (${line.tailCount} ekor)` : line.name,
        fmtQtyUnit(line.qtyMilli, line.unit),
        toRM(line.priceCents),
        toRM(line.amountCents),
      ]);
    }
    rows.push(["TOTAL", "", "", toRM(order.totalCents)]);
    rows.push([]);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows.length ? rows : [["No sales."]]);
  setNumberFormat(sheet, 2, 0, rows.length, "0.00");
  setNumberFormat(sheet, 3, 0, rows.length, "0.00");
  sheet["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
  return sheet;
}

/** Sheet 5 — today's credit sales, then every outstanding credit. */
function creditSheet(orders: Order[], outstanding: Credit[]): XLSX.WorkSheet {
  const businessDate = orders[0]?.businessDate ?? localDateStr(Date.now());
  const today = validOrders(orders).filter((order) => order.method === "Credit");
  const rows: (string | number)[][] = [[`ADDED TODAY — ${businessDate}`]];
  rows.push([...CREDIT_HEADERS]);
  const todayFirst = rows.length + 1;
  for (const order of today) {
    rows.push([order.businessDate, order.id, order.creditorName ?? "", toRM(order.totalCents)]);
  }
  rows.push(["TOTAL", "", "", 0]);
  const todayTotal = rows.length;
  rows.push([]);
  rows.push(["ALL OUTSTANDING"]);
  rows.push([...CREDIT_HEADERS]);
  const outFirst = rows.length + 1;
  const sorted = [...outstanding].sort((a, b) => b.date - a.date || b.orderId - a.orderId);
  for (const credit of sorted) {
    rows.push([localDateStr(credit.date), credit.orderId, credit.name, toRM(credit.amountCents)]);
  }
  rows.push(["TOTAL", "", "", 0]);
  const outTotal = rows.length;
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  setFormulaOrZero(sheet, `D${todayTotal}`, "D", todayFirst, today.length);
  setFormulaOrZero(sheet, `D${outTotal}`, "D", outFirst, sorted.length);
  setNumberFormat(sheet, 3, 0, rows.length, "0.00");
  sheet["!cols"] = [{ wch: 13 }, { wch: 11 }, { wch: 24 }, { wch: 14 }];
  return sheet;
}

/** Build the stable, versioned daily workbook used by Export and Close Day. */
export function buildDailyWorkbook(
  orders: Order[],
  _catalog: Item[] = [],
  outstandingCredits: Credit[] = [],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Daily sales report",
    Subject: `HQ daily workbook template v${DAILY_WORKBOOK_TEMPLATE_VERSION}`,
    Author: "Yun Fook POS",
  };
  XLSX.utils.book_append_sheet(workbook, salesListSheet(orders), "Sales List");
  XLSX.utils.book_append_sheet(workbook, todaySalesSheet(orders), "Today Sales");
  XLSX.utils.book_append_sheet(workbook, fishSalesSheet(orders), "Fish Sales");
  XLSX.utils.book_append_sheet(workbook, salesDetailSheet(orders), "Sales Detail");
  XLSX.utils.book_append_sheet(workbook, creditSheet(orders, outstandingCredits), "Credit");
  return workbook;
}

/** The daily workbook as base64 (stored on the outbox row, attached by main). */
export function buildDailyExcelB64(
  orders: Order[],
  catalog: Item[] = [],
  outstandingCredits: Credit[] = [],
): string {
  return XLSX.write(buildDailyWorkbook(orders, catalog, outstandingCredits), {
    type: "base64",
    bookType: "xlsx",
  }) as string;
}

/** Download the same workbook from Chrome or Electron's renderer. */
export function downloadDailyExcel(base64: string, filename: string): void {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function dailyEmailSubject(storeName: string, businessDate: string, auto: boolean): string {
  return `${storeName} — Daily sales ${businessDate}${auto ? " (auto-closed)" : ""}`;
}

/** Plain-text body: the same numbers as the printed day report. */
export function dailyEmailBody(
  storeName: string,
  businessDate: string,
  orders: Order[],
  auto: boolean,
): string {
  const stats = computeStats(orders, "today");
  const sales = aggregateItemSales(orders);
  const voided = orders.filter((order) => order.voidedAt != null);
  const lines: string[] = [
    `${storeName} — daily sales for ${businessDate}`,
    auto ? "(Closed automatically — the day was not closed at the till.)" : "",
    "",
    `TOTAL: ${fmtMoney(stats.totalCents)}  (${stats.count} sales)`,
    ...PAYMENT_METHODS.map((method) => {
      const bucket = stats.byMethod[method];
      return bucket.count ? `  ${method}: ${fmtMoney(bucket.totalCents)} (${bucket.count})` : "";
    }),
    voided.length
      ? `  Voided: ${voided.length} sale(s), ${fmtMoney(voided.reduce((sum, order) => sum + order.totalCents, 0))} — see Excel`
      : "",
    "",
    "By item:",
    ...sales.map(
      (sale) =>
        `  ${sale.name}: ${toQty(sale.qtyMilli)}${sale.tailCount ? ` / ${sale.tailCount} ekor` : ""} — ${fmtMoney(sale.amountCents)}`,
    ),
    "",
    `Excel template: v${DAILY_WORKBOOK_TEMPLATE_VERSION}`,
    "Full invoice export and reconciliation are attached.",
  ];
  return lines.filter((line) => line !== "").join("\n");
}
