import { describe, it, expect } from "vitest";
import { effectiveUnitPrice, appliedTier, priceLine } from "./pricing.js";
import type { PricedItem } from "./types.js";

const talapia: PricedItem = {
  id: 1, key: "talapia", name: "Talapia", image: "", unit: "kg",
  priceCents: 1800, active: true, tracksTail: false, stockMilli: null, sortOrder: 0,
  tiers: [{ id: 1, itemId: 1, minQtyMilli: 30000, priceCents: 1500 }],
};

const multiTier: PricedItem = {
  ...talapia,
  // intentionally out of order to prove sorting
  tiers: [
    { id: 2, itemId: 1, minQtyMilli: 50000, priceCents: 1300 },
    { id: 1, itemId: 1, minQtyMilli: 30000, priceCents: 1500 },
  ],
};

describe("effectiveUnitPrice", () => {
  it("uses the base price below the lowest tier", () => {
    expect(effectiveUnitPrice(talapia, 29999)).toBe(1800);
    expect(effectiveUnitPrice(talapia, 1000)).toBe(1800);
  });

  it("applies the tier exactly at the threshold", () => {
    expect(effectiveUnitPrice(talapia, 30000)).toBe(1500);
  });

  it("keeps the tier above the threshold", () => {
    expect(effectiveUnitPrice(talapia, 45000)).toBe(1500);
  });

  it("picks the highest qualifying tier regardless of input order", () => {
    expect(effectiveUnitPrice(multiTier, 30000)).toBe(1500);
    expect(effectiveUnitPrice(multiTier, 49999)).toBe(1500);
    expect(effectiveUnitPrice(multiTier, 50000)).toBe(1300);
  });

  it("falls back to base with no tiers", () => {
    expect(effectiveUnitPrice({ ...talapia, tiers: [] }, 99999)).toBe(1800);
  });
});

describe("appliedTier", () => {
  it("is null below threshold, the tier above it", () => {
    expect(appliedTier(talapia, 29999)).toBeNull();
    expect(appliedTier(talapia, 30000)?.priceCents).toBe(1500);
  });
});

describe("priceLine", () => {
  it("computes amount from the effective unit price", () => {
    // 30 kg @ RM15 = RM450 = 45000 cents
    expect(priceLine(talapia, 30000)).toMatchObject({ unitCents: 1500, amountCents: 45000 });
    // 2 kg @ RM18 = RM36 = 3600 cents
    expect(priceLine(talapia, 2000)).toMatchObject({ unitCents: 1800, amountCents: 3600 });
  });

  it("rounds fractional cents to whole cents", () => {
    // 1.5 kg @ RM18 = RM27.00 (1800 * 1500 / 1000 = 2700)
    expect(priceLine(talapia, 1500).amountCents).toBe(2700);
  });
});
