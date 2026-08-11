import { describe, it, expect } from "vitest";
import { buildOrder, formatInvNo, INV_SEQ_START, PosError } from "./orders.js";
import type { PricedItem } from "./types.js";

const fish: PricedItem = {
  id: 1, key: "talapia", name: "Talapia", image: "", unit: "kg",
  priceCents: 1800, active: true, tracksTail: true, sortOrder: 0,
  tiers: [{ id: 1, itemId: 1, minQtyMilli: 30000, priceCents: 1500 }],
};
const rice: PricedItem = {
  id: 2, key: "rice", name: "Rice", image: "", unit: "kg",
  priceCents: 350, active: true, tracksTail: false, sortOrder: 0, tiers: [],
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

describe("formatInvNo", () => {
  it("numbers a sale by the month of its business day", () => {
    expect(formatInvNo("2026-08-10", INV_SEQ_START)).toBe("08-1000");
    expect(formatInvNo("2026-08-31", 1042)).toBe("08-1042");
    expect(formatInvNo("2026-09-01", INV_SEQ_START)).toBe("09-1000");
  });

  it("keeps the month prefix exactly 3 characters, so the sequence stays readable back out", () => {
    const invNo = formatInvNo("2026-01-05", 1007);
    expect(invNo.slice(0, 3)).toBe("01-");
    expect(Number(invNo.slice(3))).toBe(1007);
  });
});
