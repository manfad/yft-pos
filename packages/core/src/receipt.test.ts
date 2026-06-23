import { describe, expect, it } from "vitest";
import { buildReceipt } from "./receipt.js";
import type { Order } from "./types.js";

describe("buildReceipt", () => {
  it("keeps quantity numeric and annotates bulk unit price with the tier threshold", () => {
    const order: Order = {
      id: 1,
      companyId: 1,
      ts: new Date(2026, 5, 23, 10, 30).getTime(),
      method: "Cash",
      totalCents: 23000,
      items: [
        {
          id: 1,
          itemId: 1,
          name: "Ikan Tilapia",
          image: "",
          unit: "kg",
          tint: "#fff",
          priceCents: 2300,
          qtyMilli: 10000,
          amountCents: 23000,
          bulkPrice: true,
          bulkMinQtyMilli: 10000,
        },
      ],
    };

    const receipt = buildReceipt(order, { storeName: "Yun Fook Trading" });

    expect(receipt.lines[0]).toMatchObject({
      qtyText: "10",
      unitPriceText: "RM 23.00/kg (10kg)",
    });
  });
});
