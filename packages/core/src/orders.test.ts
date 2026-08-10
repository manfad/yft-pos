import { describe, it, expect } from "vitest";
import { buildOrder, PosError } from "./orders.js";
import type { PricedItem } from "./types.js";

const fish: PricedItem = {
  id: 1, key: "talapia", name: "Talapia", image: "", unit: "kg",
  priceCents: 1800, active: true, tracksTail: true,
  tiers: [{ id: 1, itemId: 1, minQtyMilli: 30000, priceCents: 1500 }],
};
const rice: PricedItem = {
  id: 2, key: "rice", name: "Rice", image: "", unit: "kg",
  priceCents: 350, active: true, tracksTail: false, tiers: [],
};
const byId = new Map([[1, fish], [2, rice]]);
const resolve = (l: { itemId?: number }) => (l.itemId != null ? byId.get(l.itemId) ?? null : null);

describe("buildOrder", () => {
  it("snapshots the effective price and sums the total", () => {
    const draft = buildOrder(
      { method: "Cash", ts: 1000, lines: [{ itemId: 1, qtyMilli: 30000 }, { itemId: 2, qtyMilli: 2000 }] },
      resolve,
    );
    // fish 30kg @ RM15 = 45000, rice 2kg @ RM3.50 = 700 -> 45700
    expect(draft.totalCents).toBe(45700);
    expect(draft.lines[0]).toMatchObject({ itemId: 1, priceCents: 1500, qtyMilli: 30000 });
    expect(draft.lines[1]).toMatchObject({ itemId: 2, priceCents: 350, qtyMilli: 2000 });
    expect(draft.ts).toBe(1000);
  });

  it("rejects an empty order", () => {
    expect(() => buildOrder({ method: "Cash", lines: [] }, resolve)).toThrow(PosError);
  });

  it("rejects a bad payment method", () => {
    expect(() =>
      buildOrder({ method: "Crypto" as never, lines: [{ itemId: 1, qtyMilli: 1000 }] }, resolve),
    ).toThrow(/method must be/);
  });

  it("rejects unknown / inactive items", () => {
    expect(() => buildOrder({ method: "QR", lines: [{ itemId: 99, qtyMilli: 1000 }] }, resolve)).toThrow(
      /unknown or inactive/,
    );
    const inactive = new Map([[1, { ...fish, active: false }]]);
    expect(() =>
      buildOrder({ method: "QR", lines: [{ itemId: 1, qtyMilli: 1000 }] }, (l) =>
        l.itemId != null ? inactive.get(l.itemId) ?? null : null,
      ),
    ).toThrow(/unknown or inactive/);
  });

  it("rejects non-positive quantity", () => {
    expect(() => buildOrder({ method: "QR", lines: [{ itemId: 2, qtyMilli: 0 }] }, resolve)).toThrow(
      /qty must be > 0/,
    );
  });

  it("requires a creditor name for Credit, and carries it onto the draft", () => {
    expect(() =>
      buildOrder({ method: "Credit", lines: [{ itemId: 2, qtyMilli: 1000 }] }, resolve),
    ).toThrow(/creditor name is required/);
    const draft = buildOrder(
      { method: "Credit", creditorName: "  Pak Abu  ", lines: [{ itemId: 2, qtyMilli: 1000 }] },
      resolve,
    );
    expect(draft).toMatchObject({ method: "Credit", creditorName: "Pak Abu" });
  });
});
