import * as XLSX from "xlsx";
import {
  aggregateItemSales,
  computeStats,
  fmtMoney,
  PAYMENT_METHODS,
  toQty,
  toRM,
  type Item,
  type Order,
} from "@yf/core";

/** Increment when HQ changes the stable workbook contract. */
export const DAILY_WORKBOOK_TEMPLATE_VERSION = 1;
export const HQ_DAILY_HEADERS = [
  "Name",
  "Date",
  "Inv No",
  "Pay Type",
  "Amount",
  "Credit",
  "Fish Qty",
  "Fish Qty (Ekor)",
  "Chicken Qty (Ekor)",
  "Remarks",
] as const;
export const INVOICE_ITEM_HEADERS = [
  "Name",
  "Date",
  "Time",
  "Inv No",
  "Pay Type",
  "Item",
  "Unit",
  "Qty",
  "Ekor",
  "Unit Price",
  "Line Amount",
  "Credit",
  "Remarks",
] as const;
export const SALES_EXPORT_HEADERS = [
  "Date",
  "Time",
  "Receipt No",
  "Amount",
  "Fish Qty",
  "Tail (Fish)",
  "Tail (Chicken)",
  "Pay Type",
] as const;

const validOrders = (orders: Order[]): Order[] =>
  [...orders].filter((order) => order.voidedAt == null).sort((a, b) => a.ts - b.ts);

const isChicken = (name: string): boolean => /\b(ayam|chicken|hen|rooster)\b/i.test(name);

function animalTotals(order: Order): { fishQty: number; fish: number; chicken: number } {
  let fishQty = 0;
  let fish = 0;
  let chicken = 0;
  for (const line of order.items) {
    if (line.tailCount <= 0) continue;
    // The current tail-tracking catalogue contains fish and chicken. Treat a
    // non-chicken tail item as fish so older/deleted fish snapshots still land
    // in a stable column without relying on the live catalogue.
    if (isChicken(line.name)) chicken += line.tailCount;
    else {
      fish += line.tailCount;
      fishQty += toQty(line.qtyMilli);
    }
  }
  return { fishQty, fish, chicken };
}

function setFormulaOrZero(
  sheet: XLSX.WorkSheet,
  cell: string,
  column: string,
  dataRows: number,
  format = "0.00",
): void {
  sheet[cell] = dataRows > 0
    ? { t: "n", f: `SUM(${column}2:${column}${dataRows + 1})`, z: format }
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

/** Task 5 — the exact daily invoice template sent to HQ. */
function hqDailySheet(orders: Order[]): XLSX.WorkSheet {
  const sales = validOrders(orders);
  const rows: (string | number)[][] = sales.map((order) => {
    const animal = animalTotals(order);
    return [
      order.method === "Credit" ? (order.creditorName ?? "") : "",
      order.businessDate,
      order.id,
      order.method,
      toRM(order.totalCents),
      order.method === "Credit" ? toRM(order.totalCents) : "",
      animal.fishQty,
      animal.fish,
      animal.chicken,
      "",
    ];
  });
  const totalRow = sales.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...HQ_DAILY_HEADERS],
    ...rows,
    ["TOTAL", "", "", "", 0, 0, 0, 0, 0, ""],
  ]);
  setFormulaOrZero(sheet, `E${totalRow}`, "E", sales.length);
  setFormulaOrZero(sheet, `F${totalRow}`, "F", sales.length);
  setFormulaOrZero(sheet, `G${totalRow}`, "G", sales.length, "0.###");
  setFormulaOrZero(sheet, `H${totalRow}`, "H", sales.length, "0");
  setFormulaOrZero(sheet, `I${totalRow}`, "I", sales.length, "0");
  setNumberFormat(sheet, 4, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 5, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 6, 1, totalRow - 1, "0.###");
  setNumberFormat(sheet, 7, 1, totalRow - 1, "0");
  setNumberFormat(sheet, 8, 1, totalRow - 1, "0");
  sheet["!cols"] = [
    { wch: 24 }, { wch: 13 }, { wch: 11 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 17 },
    { wch: 20 }, { wch: 28 },
  ];
  sheet["!autofilter"] = { ref: `A1:J${Math.max(1, sales.length + 1)}` };
  return sheet;
}

/** Full item-level audit trail so HQ can inspect every non-fish quantity too. */
function invoiceItemsSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = validOrders(orders);
  const rows: (string | number)[][] = [];
  for (const order of sales) {
    const time = new Date(order.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    for (const line of order.items) {
      rows.push([
        order.method === "Credit" ? (order.creditorName ?? "") : "",
        order.businessDate,
        time,
        order.id,
        order.method,
        line.name,
        line.unit,
        toQty(line.qtyMilli),
        line.tailCount || "",
        toRM(line.priceCents),
        toRM(line.amountCents),
        order.method === "Credit" ? toRM(line.amountCents) : "",
        "",
      ]);
    }
  }
  const totalRow = rows.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...INVOICE_ITEM_HEADERS],
    ...rows,
    ["TOTAL", "", "", "", "", "", "", 0, 0, "", 0, 0, ""],
  ]);
  setFormulaOrZero(sheet, `H${totalRow}`, "H", rows.length, "0.###");
  setFormulaOrZero(sheet, `I${totalRow}`, "I", rows.length, "0");
  setFormulaOrZero(sheet, `K${totalRow}`, "K", rows.length);
  setFormulaOrZero(sheet, `L${totalRow}`, "L", rows.length);
  setNumberFormat(sheet, 7, 1, totalRow - 1, "0.###");
  setNumberFormat(sheet, 8, 1, totalRow - 1, "0");
  for (const column of [9, 10, 11]) setNumberFormat(sheet, column, 1, totalRow - 1, "0.00");
  sheet["!cols"] = [
    { wch: 24 }, { wch: 13 }, { wch: 9 }, { wch: 11 }, { wch: 12 },
    { wch: 28 }, { wch: 10 }, { wch: 11 }, { wch: 9 }, { wch: 13 },
    { wch: 14 }, { wch: 14 }, { wch: 28 },
  ];
  sheet["!autofilter"] = { ref: `A1:M${Math.max(1, rows.length + 1)}` };
  return sheet;
}

/** Task 4 — compact one-row-per-receipt spreadsheet export. */
function salesExportSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = validOrders(orders);
  const rows: (string | number)[][] = sales.map((order) => {
    const tail = animalTotals(order);
    return [
      order.businessDate,
      new Date(order.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      order.id,
      toRM(order.totalCents),
      tail.fishQty,
      tail.fish,
      tail.chicken,
      order.method,
    ];
  });
  const totalRow = sales.length + 2;
  const sheet = XLSX.utils.aoa_to_sheet([
    [...SALES_EXPORT_HEADERS],
    ...rows,
    ["TOTAL", "", "", 0, 0, 0, 0, ""],
  ]);
  setFormulaOrZero(sheet, `D${totalRow}`, "D", sales.length);
  setFormulaOrZero(sheet, `E${totalRow}`, "E", sales.length, "0.###");
  setFormulaOrZero(sheet, `F${totalRow}`, "F", sales.length, "0");
  setFormulaOrZero(sheet, `G${totalRow}`, "G", sales.length, "0");
  setNumberFormat(sheet, 3, 1, totalRow - 1, "0.00");
  setNumberFormat(sheet, 4, 1, totalRow - 1, "0.###");
  setNumberFormat(sheet, 5, 1, totalRow - 1, "0");
  setNumberFormat(sheet, 6, 1, totalRow - 1, "0");
  sheet["!cols"] = [
    { wch: 13 }, { wch: 9 }, { wch: 12 }, { wch: 14 },
    { wch: 11 }, { wch: 13 }, { wch: 16 }, { wch: 12 },
  ];
  sheet["!autofilter"] = { ref: `A1:H${Math.max(1, sales.length + 1)}` };
  return sheet;
}

/** Per-item and payment totals retained as a useful reconciliation sheet. */
function totalsSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = aggregateItemSales(orders);
  const stats = computeStats(orders, "today");
  const voided = orders.filter((order) => order.voidedAt != null);
  const rows: (string | number)[][] = [["Item", "Ekor", "Qty", "Amount (RM)"]];
  for (const sale of sales) {
    rows.push([sale.name, sale.tailCount || "", toQty(sale.qtyMilli), toRM(sale.amountCents)]);
  }
  rows.push([]);
  for (const method of PAYMENT_METHODS) {
    const bucket = stats.byMethod[method];
    rows.push([`${method} sales`, "", bucket.count, toRM(bucket.totalCents)]);
  }
  rows.push([]);
  rows.push(["Voided sales", "", voided.length, toRM(voided.reduce((sum, order) => sum + order.totalCents, 0))]);
  rows.push(["TOTAL", "", stats.count, toRM(stats.totalCents)]);
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 28 }, { wch: 11 }, { wch: 14 }, { wch: 16 }];
  return sheet;
}

/** Build the stable, versioned daily workbook used by Export and Close Day. */
export function buildDailyWorkbook(orders: Order[], _catalog: Item[] = []): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Daily sales report",
    Subject: `HQ daily workbook template v${DAILY_WORKBOOK_TEMPLATE_VERSION}`,
    Author: "Yun Fook POS",
  };
  XLSX.utils.book_append_sheet(workbook, hqDailySheet(orders), "HQ Daily");
  XLSX.utils.book_append_sheet(workbook, invoiceItemsSheet(orders), "Invoice Items");
  XLSX.utils.book_append_sheet(workbook, salesExportSheet(orders), "Sales Export");
  XLSX.utils.book_append_sheet(workbook, totalsSheet(orders), "Totals");
  return workbook;
}

/** The daily workbook as base64 (stored on the outbox row, attached by main). */
export function buildDailyExcelB64(orders: Order[], catalog: Item[] = []): string {
  return XLSX.write(buildDailyWorkbook(orders, catalog), { type: "base64", bookType: "xlsx" }) as string;
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
