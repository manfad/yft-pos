import type { Cents, Milli, Unit } from "./types.js";

// DB/domain store integers; the UI speaks decimals. These are the only places
// the conversion happens, so rounding stays consistent everywhere.

export const toRM = (cents: Cents): number => Math.round(cents) / 100;
export const toCents = (rm: number): Cents => Math.round(Number(rm) * 100);

export const toQty = (milli: Milli): number => milli / 1000;
export const toMilli = (qty: number): Milli => Math.round(Number(qty) * 1000);

/** Charge for `qtyMilli` units at `priceCents` each, rounded to whole cents. */
export const lineAmount = (priceCents: Cents, qtyMilli: Milli): Cents =>
  Math.round((priceCents * qtyMilli) / 1000);

/** Parse a user-entered price (RM) into cents, rejecting junk/negatives. */
export function priceCentsFrom(value: unknown): Cents {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new RangeError("price must be a non-negative number");
  }
  return toCents(n);
}

/** Display helpers (kept here so formatting rules live in one place). */
export const fmtMoney = (cents: Cents, prefix = "RM"): string =>
  `${prefix} ${toRM(cents).toFixed(2)}`;

export const fmtQty = (milli: Milli): string => {
  const q = toQty(milli);
  return Number.isInteger(q) ? String(q) : q.toFixed(1);
};

// "each" reads badly with a count ("1 each"); show pc/pcs instead. Other units
// are used as-is. `milli` decides singular vs plural.
export function unitLabel(unit: Unit, milli?: Milli): string {
  if (unit === "each") return milli != null && toQty(milli) === 1 ? "pc" : "pcs";
  return unit;
}

/** Quantity with its (humanised) unit, e.g. "1.5 kg", "3 pcs", "1 pc". */
export const fmtQtyUnit = (milli: Milli, unit: Unit): string =>
  `${fmtQty(milli)} ${unitLabel(unit, milli)}`;
