// Emits an officecli batch (JSON on stdout) that builds the 5-sheet HQ daily
// workbook demo:
//   1. Sales List    — one row per sale: creditor name, inv, pay type, Cash/Credit split
//   2. Today Sales   — per-item sales (qty merged with unit) + payment breakdown
//   3. Fish Sales    — one row per sale containing fish; qty is the ekor count
//   4. Sales Detail  — every sale as its own bordered block
//   5. Credit        — today's credit sales on top, full outstanding list below
//
// Usage:
//   officecli create demo-output/hq-daily-4sheet-demo.xlsx --force
//   node scripts/generate-demo-daily-officecli.mjs | officecli batch demo-output/hq-daily-4sheet-demo.xlsx

const DATE = "2026-08-10";
const DATE_LABEL = "Monday, 10 August 2026";
const STORE = "YF FISH SDN BHD";
const MONEY = "#,##0.00";

// ---------------------------------------------------------------- demo data
// Ikan Tilapia is the only fish sold; everything else is sundry stock.
const orders = [
  { inv: 1001, time: "08:15", method: "Cash", lines: [
    { name: "Ikan Tilapia", unit: "kg", price: 25.0, qty: 12.75, ekor: 18 },
    { name: "Sotong", unit: "kg", price: 28.0, qty: 2.0 },
  ]},
  { inv: 1002, time: "09:05", method: "QR", lines: [
    { name: "Sotong", unit: "kg", price: 28.0, qty: 2.0 },
    { name: "Ais Tube", unit: "bag", price: 3.5, qty: 2 },
  ]},
  { inv: 1003, time: "09:40", method: "Credit", creditor: "Pak Abu", lines: [
    { name: "Ikan Tilapia", unit: "kg", price: 25.0, qty: 4.2, ekor: 6 },
    { name: "Ayam", unit: "ekor", price: 12.0, qty: 5, ekor: 5 },
  ]},
  { inv: 1004, time: "11:05", method: "Bank", lines: [
    { name: "Udang", unit: "kg", price: 38.0, qty: 3.5 },
    { name: "Sayur Campur", unit: "kg", price: 6.0, qty: 1.5 },
  ]},
  { inv: 1005, time: "12:30", method: "Cash", lines: [
    { name: "Ikan Tilapia", unit: "kg", price: 25.0, qty: 8.0, ekor: 11 },
  ]},
  { inv: 1006, time: "13:20", method: "Credit", creditor: "Kak Ros", lines: [
    { name: "Ikan Tilapia", unit: "kg", price: 25.0, qty: 2.4, ekor: 3 },
    { name: "Sayur Campur", unit: "kg", price: 6.0, qty: 1.5 },
  ]},
  { inv: 1007, time: "14:10", method: "Cash", voided: true, lines: [
    { name: "Ikan Tilapia", unit: "kg", price: 25.0, qty: 1.0, ekor: 2 },
  ]},
  { inv: 1008, time: "16:45", method: "QR", lines: [
    { name: "Fresh Milk 1 L", unit: "bottle", price: 6.8, qty: 4 },
    { name: "Ais Tube", unit: "bag", price: 3.5, qty: 2 },
  ]},
];

// Outstanding credit carried over from previous days.
const oldCredits = [
  { date: "2026-08-05", inv: 951, name: "Pak Abu", amount: 86.5 },
  { date: "2026-08-07", inv: 968, name: "Restoran Selera", amount: 240.0 },
  { date: "2026-08-08", inv: 975, name: "Kak Ros", amount: 54.2 },
];

// ------------------------------------------------------------- derived data
const round2 = (n) => Math.round(n * 100) / 100;
const lineAmt = (l) => round2(l.price * l.qty);
const orderTotal = (o) => round2(o.lines.reduce((s, l) => s + lineAmt(l), 0));
const valid = orders.filter((o) => !o.voided);
const isFish = (name) => name.startsWith("Ikan");
const fishEkor = (o) => o.lines.reduce((s, l) => s + (isFish(l.name) ? (l.ekor ?? 0) : 0), 0);

const byItem = new Map();
for (const o of valid) {
  for (const l of o.lines) {
    const cur = byItem.get(l.name) ?? { ...l, qty: 0, ekor: 0, amount: 0 };
    cur.qty = round2(cur.qty + l.qty);
    cur.ekor += l.ekor ?? 0;
    cur.amount = round2(cur.amount + lineAmt(l));
    byItem.set(l.name, cur);
  }
}
const items = [...byItem.values()].sort((a, b) => b.amount - a.amount);

const byMethod = new Map();
for (const o of valid) {
  const cur = byMethod.get(o.method) ?? { count: 0, amount: 0 };
  cur.count += 1;
  cur.amount = round2(cur.amount + orderTotal(o));
  byMethod.set(o.method, cur);
}

const fishSales = valid.filter((o) => o.lines.some((l) => isFish(l.name)));

const todayCredits = valid
  .filter((o) => o.method === "Credit")
  .map((o) => ({ date: DATE, inv: o.inv, name: o.creditor, amount: orderTotal(o) }));
const allCredits = [...todayCredits, ...oldCredits].sort((a, b) => b.date.localeCompare(a.date) || b.inv - a.inv);

const byCreditor = new Map();
for (const c of allCredits) {
  const cur = byCreditor.get(c.name) ?? { count: 0, amount: 0 };
  cur.count += 1;
  cur.amount = round2(cur.amount + c.amount);
  byCreditor.set(c.name, cur);
}
const creditors = [...byCreditor.entries()].sort((a, b) => b[1].amount - a[1].amount);

// ------------------------------------------------------------ batch helpers
const cmds = [];
const cell = (sheet, ref, props) =>
  cmds.push({ command: "add", parent: `/${sheet}`, type: "cell", props: { ref, ...props } });
const colw = (sheet, name, width) =>
  cmds.push({ command: "add", parent: `/${sheet}`, type: "column", props: { name, width } });
const sheetSet = (sheet, props) => cmds.push({ command: "set", path: `/${sheet}`, props });

const title = (sheet, span, text, sub) => {
  cell(sheet, "A1", { value: text, merge: `A1:${span}1`, bold: true, size: "13pt", halign: "center", fill: "1F4E44", "font.color": "FFFFFF" });
  cell(sheet, "A2", { value: sub, merge: `A2:${span}2`, halign: "center", "font.color": "666666" });
};
const header = (sheet, row, cols) =>
  cols.forEach(([ref, text, halign]) =>
    cell(sheet, `${ref}${row}`, { value: text, bold: true, fill: "D9E2DC", "border.bottom": "medium", ...(halign ? { halign } : {}) }));

// ------------------------------------------------------- sheet 1: Sales List
const S1 = "Sales List";
cmds.push({ command: "set", path: "/Sheet1", props: { name: S1, tabColor: "217346" } });
cmds.push({ command: "add", parent: "/", type: "sheet", props: { name: "Today Sales", tabColor: "70AD47" } });
cmds.push({ command: "add", parent: "/", type: "sheet", props: { name: "Fish Sales", tabColor: "2E75B6" } });
cmds.push({ command: "add", parent: "/", type: "sheet", props: { name: "Sales Detail", tabColor: "ED7D31" } });
cmds.push({ command: "add", parent: "/", type: "sheet", props: { name: "Credit", tabColor: "C00000" } });

colw(S1, "A", 24); colw(S1, "B", 12); colw(S1, "C", 10); colw(S1, "D", 12); colw(S1, "E", 14); colw(S1, "F", 14);
title(S1, "F", `${STORE} — SALES LIST`, DATE_LABEL);
header(S1, 4, [["A", "Name"], ["B", "Date"], ["C", "Inv No"], ["D", "Pay Type"], ["E", "Cash (RM)", "right"], ["F", "Credit (RM)", "right"]]);
let r = 5;
for (const o of valid) {
  const credit = o.method === "Credit";
  cell(S1, `A${r}`, { value: credit ? o.creditor : "" });
  cell(S1, `B${r}`, { value: DATE, numberformat: "@" });
  cell(S1, `C${r}`, { value: o.inv });
  cell(S1, `D${r}`, { value: o.method });
  if (credit) cell(S1, `F${r}`, { value: orderTotal(o), numberformat: MONEY });
  else cell(S1, `E${r}`, { value: orderTotal(o), numberformat: MONEY });
  r++;
}
cell(S1, `A${r}`, { value: "TOTAL", bold: true, "border.top": "double" });
["B", "C", "D"].forEach((c) => cell(S1, `${c}${r}`, { "border.top": "double" }));
cell(S1, `E${r}`, { formula: `SUM(E5:E${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
cell(S1, `F${r}`, { formula: `SUM(F5:F${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
r += 2;
cell(S1, `A${r}`, { value: `${valid.length} sale(s), ${orders.length - valid.length} voided`, "font.color": "666666" });
sheetSet(S1, { freeze: "A5" });

// ------------------------------------------------------ sheet 2: Today Sales
const S2 = "Today Sales";
colw(S2, "A", 26); colw(S2, "B", 14); colw(S2, "C", 12); colw(S2, "D", 14);
title(S2, "D", `${STORE} — DAILY SALES`, DATE_LABEL);
header(S2, 4, [["A", "Item"], ["B", "Unit Price (RM)", "right"], ["C", "Qty", "right"], ["D", "Amount (RM)", "right"]]);
r = 5;
for (const i of items) {
  cell(S2, `A${r}`, { value: i.name });
  cell(S2, `B${r}`, { value: i.price, numberformat: MONEY });
  cell(S2, `C${r}`, { value: `${i.qty} ${i.unit}`, halign: "right" });
  cell(S2, `D${r}`, { value: i.amount, numberformat: MONEY });
  r++;
}
cell(S2, `A${r}`, { value: "TOTAL", bold: true, "border.top": "double" });
["B", "C"].forEach((c) => cell(S2, `${c}${r}`, { "border.top": "double" }));
cell(S2, `D${r}`, { formula: `SUM(D5:D${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
r += 2;
cell(S2, `A${r}`, { value: "BY PAYMENT", bold: true, fill: "D9E2DC", merge: `A${r}:C${r}` });
r++;
for (const [method, m] of byMethod) {
  cell(S2, `A${r}`, { value: method });
  cell(S2, `C${r}`, { value: m.count, halign: "right" });
  cell(S2, `D${r}`, { value: m.amount, numberformat: MONEY });
  r++;
}
cell(S2, `A${r}`, { value: `${valid.length} sale(s), ${orders.length - valid.length} voided`, "font.color": "666666" });
sheetSet(S2, { freeze: "A5" });

// ------------------------------------------------------- sheet 3: Fish Sales
// One row per sale that contains fish. Cash/Credit carry the full invoice
// amount; the qty column is the fish head count (ekor) — fish sell by ekor.
const S3 = "Fish Sales";
colw(S3, "A", 10); colw(S3, "B", 12); colw(S3, "C", 14); colw(S3, "D", 14); colw(S3, "E", 16);
title(S3, "E", "FISH SALES", DATE_LABEL);
header(S3, 4, [["A", "Inv No"], ["B", "Pay Type"], ["C", "Cash (RM)", "right"], ["D", "Credit (RM)", "right"], ["E", "Fish Qty (Ekor)", "right"]]);
r = 5;
for (const o of fishSales) {
  const credit = o.method === "Credit";
  cell(S3, `A${r}`, { value: o.inv });
  cell(S3, `B${r}`, { value: o.method });
  if (credit) cell(S3, `D${r}`, { value: orderTotal(o), numberformat: MONEY });
  else cell(S3, `C${r}`, { value: orderTotal(o), numberformat: MONEY });
  cell(S3, `E${r}`, { value: fishEkor(o) });
  r++;
}
cell(S3, `A${r}`, { value: "TOTAL", bold: true, "border.top": "double" });
cell(S3, `B${r}`, { "border.top": "double" });
cell(S3, `C${r}`, { formula: `SUM(C5:C${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
cell(S3, `D${r}`, { formula: `SUM(D5:D${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
cell(S3, `E${r}`, { formula: `SUM(E5:E${r - 1})`, bold: true, "border.top": "double" });
sheetSet(S3, { freeze: "A5" });

// ----------------------------------------------------- sheet 4: Sales Detail
const S4 = "Sales Detail";
colw(S4, "A", 30); colw(S4, "B", 12); colw(S4, "C", 12); colw(S4, "D", 12);
title(S4, "D", "SALES DETAIL", DATE_LABEL);
r = 4;
const COLS = ["A", "B", "C", "D"];
// One bordered block per sale: thin grid inside, medium box around.
const box = (row, top, bottom, extra = {}) =>
  COLS.forEach((c, idx) => {
    const props = { ...(extra[c] ?? {}), "border.all": "thin" };
    if (top) props["border.top"] = "medium";
    if (bottom) props["border.bottom"] = "medium";
    if (idx === 0) props["border.left"] = "medium";
    if (idx === COLS.length - 1) props["border.right"] = "medium";
    cell(S4, `${c}${row}`, props);
  });
for (const o of orders) {
  const struck = o.voided ? { strike: true } : {};
  box(r, true, false, {
    A: { value: `Inv #${o.inv}${o.creditor ? ` — ${o.creditor}` : ""}`, bold: true, fill: "EDEDED", ...struck },
    B: { value: o.time, fill: "EDEDED", ...struck },
    C: { value: o.method, fill: "EDEDED", ...struck },
    D: o.voided
      ? { value: "VOIDED", bold: true, "font.color": "C00000", fill: "EDEDED", halign: "right" }
      : { fill: "EDEDED" },
  });
  r++;
  box(r, false, false, {
    A: { value: "Item", bold: true, size: "9pt", "font.color": "666666" },
    B: { value: "Qty", bold: true, size: "9pt", "font.color": "666666", halign: "right" },
    C: { value: "Price (RM)", bold: true, size: "9pt", "font.color": "666666", halign: "right" },
    D: { value: "Amount (RM)", bold: true, size: "9pt", "font.color": "666666", halign: "right" },
  });
  r++;
  for (const l of o.lines) {
    box(r, false, false, {
      A: { value: l.ekor && l.unit !== "ekor" ? `${l.name} (${l.ekor} ekor)` : l.name, ...struck },
      B: { value: `${l.qty} ${l.unit}`, halign: "right", ...struck },
      C: { value: l.price, numberformat: MONEY, ...struck },
      D: { value: lineAmt(l), numberformat: MONEY, ...struck },
    });
    r++;
  }
  box(r, false, true, {
    A: { value: "TOTAL", bold: true, ...struck },
    D: { value: orderTotal(o), numberformat: MONEY, bold: true, ...struck },
  });
  r += 2; // blank row between blocks
}

// ----------------------------------------------------------- sheet 5: Credit
const S5 = "Credit";
colw(S5, "A", 12); colw(S5, "B", 10); colw(S5, "C", 24); colw(S5, "D", 14);
title(S5, "D", "CREDIT LEDGER", DATE_LABEL);
const creditRows = (startRow, rows) => {
  header(S5, startRow, [["A", "Date"], ["B", "Inv No"], ["C", "Name"], ["D", "Amount (RM)", "right"]]);
  let row = startRow + 1;
  for (const c of rows) {
    cell(S5, `A${row}`, { value: c.date, numberformat: "@" });
    cell(S5, `B${row}`, { value: `#${String(c.inv).padStart(4, "0")}` });
    cell(S5, `C${row}`, { value: c.name });
    cell(S5, `D${row}`, { value: c.amount, numberformat: MONEY });
    row++;
  }
  cell(S5, `A${row}`, { value: "TOTAL", bold: true, "border.top": "double" });
  ["B", "C"].forEach((c) => cell(S5, `${c}${row}`, { "border.top": "double" }));
  cell(S5, `D${row}`, { formula: `SUM(D${startRow + 1}:D${row - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });
  return row;
};
cell(S5, "A4", { value: `ADDED TODAY — ${DATE}`, bold: true, fill: "FFF2CC", merge: "A4:D4" });
r = creditRows(5, todayCredits);
r += 2;
cell(S5, `A${r}`, { value: "ALL OUTSTANDING", bold: true, fill: "E2EFDA", merge: `A${r}:D${r}` });
r = creditRows(r + 1, allCredits);
r += 2;
// Outstanding balance per creditor — who owes what across every invoice.
cell(S5, `A${r}`, { value: "BY CREDITOR", bold: true, fill: "D9E2DC", merge: `A${r}:D${r}` });
r++;
header(S5, r, [["A", "Name"], ["C", "Invoices", "right"], ["D", "Amount (RM)", "right"]]);
r++;
const creditorFirst = r;
for (const [name, t] of creditors) {
  cell(S5, `A${r}`, { value: name });
  cell(S5, `C${r}`, { value: t.count, halign: "right" });
  cell(S5, `D${r}`, { value: t.amount, numberformat: MONEY });
  r++;
}
cell(S5, `A${r}`, { value: "TOTAL", bold: true, "border.top": "double" });
["B", "C"].forEach((c) => cell(S5, `${c}${r}`, { "border.top": "double" }));
cell(S5, `D${r}`, { formula: `SUM(D${creditorFirst}:D${r - 1})`, numberformat: MONEY, bold: true, "border.top": "double" });

process.stdout.write(JSON.stringify(cmds));
