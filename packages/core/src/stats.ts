import type { Order, Period, Stats, PaymentMethod, Unit, Cents, Milli } from "./types.js";
import { PAYMENT_METHODS } from "./types.js";

/** A period → [startMs, endMs) window, computed from `now` (injectable for tests). */
export function periodRange(period: Period, now: Date = new Date()): [number, number] {
  if (period === "today") {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return [s, s + 86_400_000];
  }
  if (period === "month") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return [s, e];
  }
  return [0, Number.MAX_SAFE_INTEGER]; // "all"
}

/** Aggregate already-fetched orders into count/total + per-method breakdown. */
export function computeStats(orders: Order[], period: Period): Stats {
  const byMethod = Object.fromEntries(
    PAYMENT_METHODS.map((m) => [m, { count: 0, totalCents: 0 }]),
  ) as Record<PaymentMethod, { count: number; totalCents: number }>;

  // Voided (cancelled) sales never count toward totals.
  let totalCents = 0;
  let count = 0;
  for (const o of orders) {
    if (o.voidedAt != null) continue;
    count++;
    totalCents += o.totalCents;
    const bucket = byMethod[o.method];
    bucket.count++;
    bucket.totalCents += o.totalCents;
  }
  return { period, count, totalCents, byMethod };
}

/** Per-product roll-up: how much of each item sold and what it earned. */
export interface ItemSale {
  itemId: number | null;
  name: string;
  image: string;
  tint: string;
  unit: Unit;
  qtyMilli: Milli;
  /** total head count ("ekor") sold; 0 for items that don't track tails */
  tailCount: number;
  amountCents: Cents;
  /** number of sale lines this item appeared in */
  lines: number;
}

/**
 * Aggregate order line items into per-product totals, sorted by quantity sold
 * (descending) — so the first entry is the "top seller". Items are keyed by
 * itemId when present, else by name+unit (covers deleted items).
 */
export function aggregateItemSales(orders: Order[]): ItemSale[] {
  const map = new Map<string, ItemSale>();
  for (const o of orders) {
    if (o.voidedAt != null) continue; // cancelled sales sold nothing
    for (const l of o.items) {
      const key = l.itemId != null ? `id:${l.itemId}` : `name:${l.name}:${l.unit}`;
      const cur = map.get(key);
      if (cur) {
        cur.qtyMilli += l.qtyMilli;
        cur.tailCount += l.tailCount;
        cur.amountCents += l.amountCents;
        cur.lines += 1;
      } else {
        map.set(key, {
          itemId: l.itemId,
          name: l.name,
          image: l.image,
          tint: l.tint,
          unit: l.unit,
          qtyMilli: l.qtyMilli,
          tailCount: l.tailCount,
          amountCents: l.amountCents,
          lines: 1,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.qtyMilli - a.qtyMilli);
}
