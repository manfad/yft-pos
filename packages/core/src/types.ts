// Domain types for the POS. Money is stored as integer **cents** and quantity
// as integer **milli-units** (so 1.5 kg = 1500) to avoid float drift — the same
// convention as the original backend. UI converts to/from decimals at the edge.

export type Cents = number;
export type Milli = number;

export type PaymentMethod = "Cash" | "Bank" | "QR";
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["Cash", "Bank", "QR"];

export type Unit = "kg" | "cup" | "box" | "pack" | "pieces" | "bottle" | "each";

/** A company/tenant (lookup table). */
export interface Company {
  id: number;
  name: string;
}

/** A unit of sale, e.g. kg / box / bottle (lookup table). */
export interface UnitType {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  /** Owning company/tenant — items are sold only under their company. */
  companyId: number;
  key: string;
  name: string;
  image: string;
  unit: Unit;
  tint: string;
  priceCents: Cents;
  active: boolean;
}

/** A quantity-break: at >= minQtyMilli the unit price drops to priceCents. */
export interface PriceTier {
  id: number;
  itemId: number;
  minQtyMilli: Milli;
  priceCents: Cents;
}

/** An item together with its tiers — the unit of work for pricing. */
export interface PricedItem extends Item {
  tiers: PriceTier[];
}

/** A line snapshot stored on the order, so receipts stay correct after edits. */
export interface OrderLine {
  id: number;
  itemId: number | null;
  name: string;
  image: string;
  unit: Unit;
  tint: string;
  /** the *effective* unit price charged (after any tier discount) */
  priceCents: Cents;
  qtyMilli: Milli;
  amountCents: Cents;
  /** True when a quantity-break price was applied at sale time. */
  bulkPrice: boolean;
  /** The quantity-break threshold that was applied, if snapshotted. */
  bulkMinQtyMilli?: Milli;
}

export interface Order {
  id: number;
  /** Company/tenant the sale was made under. */
  companyId: number;
  ts: number; // epoch millis
  method: PaymentMethod;
  totalCents: Cents;
  items: OrderLine[];
}

export type Period = "today" | "month" | "all";

export interface Stats {
  period: Period;
  count: number;
  totalCents: Cents;
  byMethod: Record<PaymentMethod, { count: number; totalCents: Cents }>;
}
