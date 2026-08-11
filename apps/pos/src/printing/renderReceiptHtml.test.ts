import { describe, expect, it } from "vitest";
import type { Receipt } from "@yf/core";
import { printableWidthMm, renderReceiptHtml } from "./renderReceiptHtml";

const receipt: Receipt = {
  storeName: "Yun Fook Trading",
  invNo: "08-1000",
  dateText: "10 Aug 2026 · 09:00 am",
  method: "Cash",
  itemCount: 1,
  lines: [
    {
      name: "Ikan Tilapia",
      qtyText: "1.25 kg",
      unitPriceText: "RM 25.00/kg",
      amountText: "RM 31.25",
    },
  ],
  totalText: "RM 31.25",
  footer: "Thank you!",
};

describe("receipt print layout", () => {
  it("keeps content inside the printable area of an 80 mm roll", () => {
    expect(printableWidthMm(80)).toBe(72);
    const html = renderReceiptHtml(receipt, 80);
    expect(html).toContain("@page { size: 80mm auto; margin: 0; }");
    expect(html).toContain("width: 72mm;");
    expect(html).toContain("font-family: Verdana,");
  });

  it("prints the invoice number, not the internal order id", () => {
    expect(renderReceiptHtml(receipt)).toContain("Receipt #08-1000");
  });
});
