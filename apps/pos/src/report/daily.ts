import * as XLSX from "xlsx";
import {
  aggregateItemSales,
  computeStats,
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
export const DAILY_WORKBOOK_TEMPLATE_VERSION = 4;

// v4 sheet set (v3 held Today Sales' credit items in the one item block):
//   Sales List — one row per sale, amount split into Cash/Credit columns
//   Today Sales — per-item totals (qty merged with unit), credit items in their
//     own BY ITEM - CREDIT block below, then TOTAL over both + payment breakdown
//   <one sheet per ekor item> — every active tail-tracking item in the catalogue
//     gets its own sheet, named after the item, in catalogue order. One row per
//     sale containing that item; qty is that item's ekor count. Emitted even
//     with no sales that day so the workbook shape stays stable for HQ.
//     (v2 had a single hand-rolled "Fish Sales" sheet here.)
//   Sales Detail — every sale as its own block, voided ones marked
//   Credit — today's credit sales, then the full outstanding ledger
export const SALES_LIST_HEADERS = ["#", "Name", "Date", "Inv No", "Pay Type", "Cash", "Credit"] as const;
export const TODAY_SALES_HEADERS = ["Item", "Unit Price (RM)", "Qty", "Amount (RM)"] as const;
export const EKOR_SHEET_HEADERS = ["#", "Inv No", "Pay Type", "Cash", "Credit", "Qty (Ekor)"] as const;
export const CREDIT_HEADERS = ["Date", "Inv No", "Name", "Amount (RM)"] as const;

/** Sheet names Excel refuses, and the length it truncates at. */
const FORBIDDEN_SHEET_CHARS = /[\\/?*[\]:]/g;
const SHEET_NAME_MAX = 31;

/** The fixed sheets, so an item named "Credit" cannot shadow one of them. */
const FIXED_SHEET_NAMES = ["Sales List", "Today Sales", "Sales Detail", "Credit"] as const;

/**
 * An item name turned into a legal, unique sheet name. `taken` holds the names
 * already used in the workbook and gains the returned one, so callers just
 * thread the same set through every item.
 */
export function sheetNameFor(itemName: string, taken: Set<string>): string {
  const cleaned = itemName.replace(FORBIDDEN_SHEET_CHARS, "").trim().slice(0, SHEET_NAME_MAX).trim();
  const base = cleaned || "Item";
  let name = base;
  for (let n = 2; taken.has(name); n += 1) {
    const suffix = ` ${n}`;
    name = `${base.slice(0, SHEET_NAME_MAX - suffix.length).trim()}${suffix}`;
  }
  taken.add(name);
  return name;
}

const validOrders = (orders: Order[]): Order[] =>
  [...orders].filter((order) => order.voidedAt == null).sort((a, b) => a.ts - b.ts);

/** Head count ("ekor") of one item on an order, summed over its lines. */
const itemEkor = (order: Order, itemId: number): number => {
  let ekor = 0;
  for (const line of order.items) {
    if (line.itemId === itemId) ekor += line.tailCount;
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

/** Same, for a column whose rows are split into blocks by a section heading. */
function setBlockSumOrZero(
  sheet: XLSX.WorkSheet,
  cell: string,
  column: string,
  blocks: { firstRow: number; rows: number }[],
  format = "0.00",
): void {
  const sums = blocks
    .filter((block) => block.rows > 0)
    .map((block) => `SUM(${column}${block.firstRow}:${column}${block.firstRow + block.rows - 1})`);
  sheet[cell] = sums.length
    ? { t: "n", f: sums.join("+"), z: format }
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
  const voided = [...orders].filter((order) => order.voidedAt != null).sort((a, b) => a.ts - b.ts);
  const rows: (string | number)[][] = sales.map((order, index) => {
    const [cash, credit] = cashCredit(order);
    return [
      index + 1,
      order.method === "Credit" ? (order.creditorName ?? "") : "",
      order.businessDate,
      order.invNo,
      order.method,
      cash,
      credit,
    ];
  });
  const totalRow = sales.length + 2;
  // Voided sales sit below the total — visible but counted nowhere. xlsx (CE)
  // cannot write strikethrough, so the Name column carries a VOIDED marker.
  const voidedRows: (string | number)[][] = voided.map((order) => {
    const [cash, credit] = cashCredit(order);
    const name = order.method === "Credit" ? (order.creditorName ?? "") : "";
    return ["", name ? `${name} (VOIDED)` : "VOIDED", order.businessDate, order.invNo, order.method, cash, credit];
  });
  const sheet = XLSX.utils.aoa_to_sheet([
    [...SALES_LIST_HEADERS],
    ...rows,
    ["TOTAL", "", "", "", "", 0, 0],
    ...(voidedRows.length ? [[], ["CANCELLED"], ...voidedRows] : []),
  ]);
  setFormulaOrZero(sheet, `F${totalRow}`, "F", 2, sales.length);
  setFormulaOrZero(sheet, `G${totalRow}`, "G", 2, sales.length);
  const lastRow = totalRow + (voidedRows.length ? voidedRows.length + 2 : 0) - 1;
  setNumberFormat(sheet, 5, 1, lastRow, "0.00");
  setNumberFormat(sheet, 6, 1, lastRow, "0.00");
  sheet["!cols"] = [
    { wch: 5 }, { wch: 24 }, { wch: 13 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];
  sheet["!autofilter"] = { ref: `A1:G${Math.max(1, sales.length + 1)}` };
  return sheet;
}

/** Sheet 2 — per-item totals (qty merged with its unit) + payment breakdown. */
function todaySalesSheet(orders: Order[]): XLSX.WorkSheet {
  // Credit sales are money owed rather than money taken, so their items get
  // their own block below the paid ones — same split as the printed day report
  // (renderDayReportHtml.ts). TOTAL still spans both.
  const sales = aggregateItemSales(orders.filter((order) => order.method !== "Credit"));
  const creditSales = aggregateItemSales(orders.filter((order) => order.method === "Credit"));
  const stats = computeStats(orders, "today");
  const voided = orders.filter((order) => order.voidedAt != null);

  const itemRow = (sale: (typeof sales)[number]): (string | number)[] => {
    const qty = toQty(sale.qtyMilli);
    return [
      sale.name,
      qty > 0 ? toRM(Math.round(sale.amountCents / qty)) : "",
      fmtQtyUnit(sale.qtyMilli, sale.unit),
      toRM(sale.amountCents),
    ];
  };

  const rows: (string | number)[][] = [[...TODAY_SALES_HEADERS]];
  for (const sale of sales) rows.push(itemRow(sale));
  const blocks = [{ firstRow: 2, rows: sales.length }];

  if (creditSales.length) {
    rows.push([]);
    rows.push(["BY ITEM - CREDIT"]);
    blocks.push({ firstRow: rows.length + 1, rows: creditSales.length });
    for (const sale of creditSales) rows.push(itemRow(sale));
  }

  const totalRowIndex = rows.length + 1; // 1-based sheet row of the TOTAL line
  rows.push(["TOTAL", "", "", 0]);
  rows.push([]);
  rows.push(["BY PAYMENT"]);
  for (const method of PAYMENT_METHODS) {
    const bucket = stats.byMethod[method];
    if (bucket.count) rows.push([method, "", bucket.count, toRM(bucket.totalCents)]);
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
  setBlockSumOrZero(sheet, `D${totalRowIndex}`, "D", blocks);
  setNumberFormat(sheet, 1, 1, totalRowIndex - 1, "0.00");
  setNumberFormat(sheet, 3, 1, rows.length, "0.00");
  sheet["!cols"] = [{ wch: 26 }, { wch: 15 }, { wch: 13 }, { wch: 14 }];
  return sheet;
}

/**
 * One sheet per tail-tracking item — a sale appears if it carries any line of
 * that item, matched on `itemId` so renaming the item cannot reclassify it.
 */
function ekorSheet(orders: Order[], itemId: number): XLSX.WorkSheet {
  const sales = validOrders(orders).filter((order) => order.items.some((line) => line.itemId === itemId));
  const rows: (string | number)[][] = sales.map((order, index) => {
    const [cash, credit] = cashCredit(order);
    return [index + 1, order.invNo, order.method, cash, credit, itemEkor(order, itemId)];
  });
  const totalRow = sales.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...EKOR_SHEET_HEADERS],
    ...rows,
    ["TOTAL", "", "", 0, 0, 0],
  ]);
  setFormulaOrZero(sheet, `D${totalRow}`, "D", 2, sales.length);
  setFormulaOrZero(sheet, `E${totalRow}`, "E", 2, sales.length);
  setFormulaOrZero(sheet, `F${totalRow}`, "F", 2, sales.length, "0");
  setNumberFormat(sheet, 3, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 4, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 5, 1, totalRow - 1, "0");
  sheet["!cols"] = [{ wch: 5 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  sheet["!autofilter"] = { ref: `A1:F${Math.max(1, sales.length + 1)}` };
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
      `Inv #${order.invNo}${order.creditorName ? ` — ${order.creditorName}` : ""}`,
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
    rows.push([order.businessDate, order.invNo, order.creditorName ?? "", toRM(order.totalCents)]);
  }
  rows.push(["TOTAL", "", "", 0]);
  const todayTotal = rows.length;
  rows.push([]);
  rows.push(["ALL OUTSTANDING"]);
  rows.push([...CREDIT_HEADERS]);
  const outFirst = rows.length + 1;
  const sorted = [...outstanding].sort((a, b) => b.date - a.date || b.orderId - a.orderId);
  for (const credit of sorted) {
    rows.push([localDateStr(credit.date), credit.invNo, credit.name, toRM(credit.amountCents)]);
  }
  rows.push(["TOTAL", "", "", 0]);
  const outTotal = rows.length;
  // Outstanding balance per creditor — who owes what across every invoice.
  // The name spans A:B so the summary has no dead column in the middle.
  const merges: XLSX.Range[] = [];
  const mergeNameCell = () =>
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 1 } });
  rows.push([]);
  rows.push(["BY CREDITOR"]);
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 3 } });
  rows.push(["Name", "", "Invoices", "Amount (RM)"]);
  mergeNameCell();
  const byCreditor = new Map<string, { count: number; cents: number }>();
  for (const credit of sorted) {
    const cur = byCreditor.get(credit.name) ?? { count: 0, cents: 0 };
    cur.count += 1;
    cur.cents += credit.amountCents;
    byCreditor.set(credit.name, cur);
  }
  const creditors = [...byCreditor.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const creditorFirst = rows.length + 1;
  for (const [name, t] of creditors) {
    rows.push([name, "", t.count, toRM(t.cents)]);
    mergeNameCell();
  }
  rows.push(["TOTAL", "", "", 0]);
  const creditorTotal = rows.length;
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = merges;
  setFormulaOrZero(sheet, `D${todayTotal}`, "D", todayFirst, today.length);
  setFormulaOrZero(sheet, `D${outTotal}`, "D", outFirst, sorted.length);
  setFormulaOrZero(sheet, `D${creditorTotal}`, "D", creditorFirst, creditors.length);
  setNumberFormat(sheet, 3, 0, rows.length, "0.00");
  sheet["!cols"] = [{ wch: 13 }, { wch: 11 }, { wch: 24 }, { wch: 14 }];
  return sheet;
}

/** Build the stable, versioned daily workbook used by Export and Close Day. */
export function buildDailyWorkbook(
  orders: Order[],
  catalog: Item[] = [],
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
  const taken = new Set<string>(FIXED_SHEET_NAMES);
  for (const item of catalog.filter((candidate) => candidate.active && candidate.tracksTail)) {
    XLSX.utils.book_append_sheet(workbook, ekorSheet(orders, item.id), sheetNameFor(item.name, taken));
  }
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

/** Plain-text cover note — all figures live in the attached workbook. */
export function dailyEmailBody(
  storeName: string,
  businessDate: string,
  _orders: Order[],
  auto: boolean,
): string {
  const lines: string[] = [
    `${storeName} — daily sales for ${businessDate}`,
    auto ? "(Closed automatically — the day was not closed at the till.)" : "",
    "",
    `Excel template: v${DAILY_WORKBOOK_TEMPLATE_VERSION}`,
    "Full invoice export and reconciliation are attached.",
  ];
  return lines.filter((line) => line !== "").join("\n");
}
