import type { Item, Milli } from "./types.js";

// An item opts into stock tracking by having a non-null stockMilli; null means
// "don't track" and sells without limit. Countable units hold whole counts
// (5 cups = 5000), kg items hold weight (12.5 kg = 12500) — either way sales
// deduct the sold qtyMilli. Independent of Ekor: a tail-tracking fish can also
// track stock, and its head count never touches the stock figure.

type Stockable = Pick<Item, "stockMilli">;

/** True when sales of this item deduct (and are capped by) its stock. */
export function isStockTracked(item: Stockable): boolean {
  return item.stockMilli != null;
}

/** Milli-units still sellable; Infinity when the item isn't tracked. */
export function stockLeftMilli(item: Stockable): Milli {
  return isStockTracked(item) ? Math.max(0, item.stockMilli!) : Number.POSITIVE_INFINITY;
}
