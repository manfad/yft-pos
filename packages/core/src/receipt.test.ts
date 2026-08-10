import { describe, expect, it } from "vitest";
import { buildReceipt } from "./receipt.js";
import type { Order } from "./types.js";

describe("buildReceipt", () => {
  it("keeps quantity numeric and annotates bulk unit price with the tier threshold", () => {
    const order: Order = {
      id: 1,
      companyId: 1,
      ts: new Date(2026, 5, 23, 10, 30).getTime(),
      businessDate: "2026-06-23",
      voidedAt: null,
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
          tailCount: 0,
          bulkPrice: true,
          bulkMinQtyMilli: 10000,
        },
      ],
    };

    const receipt = buildReceipt(order, { storeName: "Yun Fook Trading" });

    expect(receipt.lines[0]).toMatchObject({
      qtyText: "10 kg",
      unitPriceText: "RM 23.00/kg (10kg)",
    });
  });

  it("appends the ekor count to the name and keeps counted units bare", () => {
    const order: Order = {
      id: 2,
      companyId: 1,
      ts: new Date(2026, 5, 23, 10, 30).getTime(),
      businessDate: "2026-06-23",
      voidedAt: null,
      method: "Cash",
      totalCents: 3180,
      items: [
        {
          id: 1, itemId: 1, name: "Ikan Tilapia", image: "", unit: "kg", tint: "#fff",
          priceCents: 2500, qtyMilli: 1200, amountCents: 3000, tailCount: 6, bulkPrice: false,
        },
        {
          id: 2, itemId: 2, name: "Fresh Milk 1 L", image: "", unit: "bottle", tint: "#fff",
          priceCents: 180, qtyMilli: 1000, amountCents: 180, tailCount: 0, bulkPrice: false,
        },
      ],
    };

    const receipt = buildReceipt(order, { storeName: "Yun Fook Trading" });

    // fish: name carries the head count, qty carries the kg unit
    expect(receipt.lines[0]).toMatchObject({ name: "Ikan Tilapia (6 ekor)", qtyText: "1.2 kg" });
    // bottle: no ekor suffix, bare number qty
    expect(receipt.lines[1]).toMatchObject({ name: "Fresh Milk 1 L", qtyText: "1" });
  });
});
