import {
  aggregateItemSales,
  computeStats,
  fmtMoney,
  fmtQtyUnit,
  PAYMENT_METHODS,
  type Order,
} from "@yf/core";
import { printableWidthMm } from "./renderReceiptHtml";

// The paper copy of the daily sales report, printed on the roll at Close Day —
// same layout family as the receipt (renderReceiptHtml.ts).

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Bare right-aligned numbers in the amount column ("253.00", no "RM ").
const rm = (cents: number): string => fmtMoney(cents, "").trim();

export function renderDayReportHtml(opts: {
  storeName: string;
  businessDate: string;
  orders: Order[];
  paperWidthMm?: number;
}): string {
  const width = opts.paperWidthMm ?? 80;
  const contentWidth = printableWidthMm(width);
  const stats = computeStats(opts.orders, "today");
  const sales = aggregateItemSales(opts.orders);
  const voided = opts.orders.filter((o) => o.voidedAt != null);

  const itemRows = sales
    .map(
      (s) => `
      <div class="row">
        <span class="name">${esc(s.name)}</span>
        <span class="qty">${s.tailCount ? `${s.tailCount} ekor · ` : ""}${esc(fmtQtyUnit(s.qtyMilli, s.unit))}</span>
        <span class="amt">${esc(rm(s.amountCents))}</span>
      </div>`,
    )
    .join("");

  const methodRows = PAYMENT_METHODS.map((m) => {
    const b = stats.byMethod[m];
    if (!b.count) return "";
    return `<div class="row"><span class="name">${m} (${b.count})</span><span class="amt">${esc(rm(b.totalCents))}</span></div>`;
  }).join("");

  const voidRow = voided.length
    ? `<div class="row void"><span class="name">Voided: ${voided.length} sale(s)</span><span class="amt">${esc(
        rm(voided.reduce((a, o) => a + o.totalCents, 0)),
      )}</span></div>`
    : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Daily report ${esc(opts.businessDate)}</title>
<style>
  @page { size: ${width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; overflow: hidden; }
  body {
    width: ${contentWidth}mm;
    max-width: ${contentWidth}mm;
    font-family: Arial, Helvetica, sans-serif;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #000;
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report { width: 100%; padding: 3mm 2mm 6mm; overflow: hidden; }
  .store { text-align: center; font-size: 13pt; font-weight: 900; text-transform: uppercase; }
  .meta { text-align: center; font-size: 8.5pt; font-weight: 700; margin-top: 1mm; }
  .hr { border-top: 1px dashed #000; margin: 2.2mm 0; }
  .h { font-size: 8.5pt; font-weight: 900; letter-spacing: 0.3px; margin-bottom: 1.4mm; }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 1.5mm;
    font-size: 9.5pt;
    margin-bottom: 1.4mm;
    align-items: baseline;
  }
  .row .name { font-weight: 900; overflow-wrap: anywhere; }
  .row .qty { white-space: nowrap; font-size: 8pt; font-weight: 700; color: #000; }
  .row .amt { white-space: nowrap; font-weight: 900; text-align: right; min-width: 16mm; }
  .row.void .name, .row.void .amt { font-weight: 400; text-decoration: line-through; }
  .total {
    display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 3mm;
    font-size: 14pt; font-weight: 900; margin-top: 1mm;
  }
  .count { text-align: center; font-size: 8.5pt; font-weight: 700; margin-top: 2.5mm; }
</style>
</head>
<body>
  <div class="report">
    <div class="store">${esc(opts.storeName)}</div>
    <div class="meta">DAILY SALES REPORT</div>
    <div class="meta">${esc(opts.businessDate)}</div>
    <div class="hr"></div>
    <div class="h">BY ITEM</div>
    ${itemRows || '<div class="meta">No sales.</div>'}
    <div class="hr"></div>
    <div class="h">BY PAYMENT</div>
    ${methodRows}
    ${voidRow}
    <div class="hr"></div>
    <div class="total"><span>TOTAL (RM)</span><span>${esc(rm(stats.totalCents))}</span></div>
    <div class="count">${stats.count} sale(s)</div>
  </div>
</body>
</html>`;
}
