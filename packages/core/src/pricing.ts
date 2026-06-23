import type { Cents, Milli, PriceTier, PricedItem } from "./types.js";
import { lineAmount } from "./money.js";

// Quantity-break pricing. Example: Talapia is RM18/kg, but a tier
// { minQtyMilli: 30000, priceCents: 1500 } drops it to RM15/kg once the line
// reaches 30 kg. The *highest* qualifying tier wins, so tiers can be listed in
// any order. The base item price applies below the lowest tier.

/** Sort tiers ascending by threshold (defensive — callers may pass any order). */
const byThreshold = (a: PriceTier, b: PriceTier): number =>
  a.minQtyMilli - b.minQtyMilli;

/** The unit price (cents) charged for `qtyMilli` of this item, after tiers. */
export function effectiveUnitPrice(item: PricedItem, qtyMilli: Milli): Cents {
  let price = item.priceCents;
  for (const tier of [...item.tiers].sort(byThreshold)) {
    if (qtyMilli >= tier.minQtyMilli) price = tier.priceCents;
  }
  return price;
}

/** The applied tier (if any) — handy for showing "discount applied" in the UI. */
export function appliedTier(item: PricedItem, qtyMilli: Milli): PriceTier | null {
  let applied: PriceTier | null = null;
  for (const tier of [...item.tiers].sort(byThreshold)) {
    if (qtyMilli >= tier.minQtyMilli) applied = tier;
  }
  return applied;
}

/** Effective unit price + line total for a quantity of an item. */
export function priceLine(
  item: PricedItem,
  qtyMilli: Milli,
): { unitCents: Cents; amountCents: Cents; tier: PriceTier | null } {
  const unitCents = effectiveUnitPrice(item, qtyMilli);
  return {
    unitCents,
    amountCents: lineAmount(unitCents, qtyMilli),
    tier: appliedTier(item, qtyMilli),
  };
}
