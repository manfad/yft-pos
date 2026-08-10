import type { Receipt } from "@yf/core";

// Render a Receipt into a standalone HTML document sized for an 80mm thermal
// roll. Printed via the OS print pipeline, so any driver-installed printer works
// (and a normal A4 printer too, for testing before the thermal unit arrives).

export const PAPER_WIDTH_MM = 80; // default; overridable per print via settings

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Drop the "RM " prefix from a money string ("RM 253.00" -> "253.00") so the
// line-item amount column shows bare, right-aligned numbers.
const amt = (s: string): string => {
  const i = s.indexOf(" ");
  return esc(i < 0 ? s : s.slice(i + 1));
};

export function renderReceiptHtml(r: Receipt, widthMm: number = PAPER_WIDTH_MM): string {
  const rows = r.lines
    .map(
      (l) => `
      <div class="item">
        <div class="item-row">
          <span class="item-detail">
            <span class="item-name">${esc(l.name)}</span>
            <span class="item-rate">${esc(l.unitPriceText)}</span>
          </span>
          <span class="item-qty">${esc(l.qtyText)}</span>
          <span class="item-amount">${amt(l.amountText)}</span>
        </div>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt #${r.orderId}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${widthMm}mm;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-variant-numeric: tabular-nums;
    color: #000;
    line-height: 1.22;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .receipt { padding: 4mm 3.5mm 5mm; }
  .store {
    text-align: center;
    font-size: 12pt;
    font-weight: 800;
    letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .meta {
    text-align: center;
    font-size: 7.5pt;
    margin-top: 1mm;
    line-height: 1.35;
  }
  .hr {
    border-top: 1px dashed #000;
    margin: 2.2mm 0;
  }
  .item {
    margin-bottom: 2mm;
    font-size: 8.5pt;
    break-inside: avoid;
  }
  .table-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 13mm 22mm;
    gap: 2.5mm;
    font-size: 6.8pt;
    font-weight: 400;
    letter-spacing: 0.5px;
    margin-bottom: 1.6mm;
  }
  .table-head .h-qty { text-align: right; }
  .table-head .h-amt { text-align: right; }
  .item-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 13mm 22mm;
    gap: 2.5mm;
    align-items: baseline;
  }
  .item-detail {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.6mm;
    overflow-wrap: anywhere;
  }
  .item-name { font-weight: 800; }
  .item-rate {
    color: #333;
    font-size: 6.7pt;
    font-weight: 500;
  }
  .item-qty {
    text-align: right;
    white-space: nowrap;
  }
  .item-amount {
    font-weight: 800;
    white-space: nowrap;
    text-align: right;
  }
  .total {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 3mm;
    font-size: 13pt;
    font-weight: 900;
    line-height: 1.15;
    margin-top: 0.5mm;
  }
  .pay {
    display: flex;
    justify-content: space-between;
    gap: 3mm;
    font-size: 7.5pt;
    margin-top: 2mm;
  }
  .foot {
    text-align: center;
    font-size: 7.2pt;
    margin-top: 3mm;
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="meta">Receipt #${r.orderId}</div>
    <div class="store">${esc(r.storeName)}</div>
    <div class="meta">${esc(r.dateText)}</div>
    <div class="hr"></div>
    <div class="table-head"><span>ITEM</span><span class="h-qty">QTY</span><span class="h-amt">AMOUNT (RM)</span></div>
    ${rows}
    <div class="hr"></div>
    <div class="total"><span>TOTAL</span><span>${esc(r.totalText)}</span></div>
    <div class="pay"><span>${r.itemCount} item(s)</span><span>Paid: ${esc(r.method)}</span></div>
    <div class="foot">${esc(r.footer)}</div>
  </div>
</body>
</html>`;
}
