import type { Company, Order, PaymentMethod, PricedItem, UnitType, Unit } from "./types.js";

// The storage boundary. Implementations do *only* raw persistence — no pricing,
// no totals — so the domain rules stay in one place (pricing.ts / orders.ts).
// Async because that's the lowest common denominator: sql.js (sync) wraps
// trivially, while tauri-plugin-sql (async) could not be made sync.

export interface ItemInput {
  /** Owning company; defaults to 1 (the first/primary company) when omitted. */
  companyId?: number;
  key: string;
  name: string;
  image?: string;
  unit?: Unit;
  tint?: string;
  priceCents: number;
}

export type ItemPatch = Partial<Omit<ItemInput, "key">> & { active?: boolean };

/** A tier without ids — what the admin editor submits. */
export interface TierInput {
  minQtyMilli: number;
  priceCents: number;
}

/** A fully-priced, ready-to-persist order (built by orders.buildOrder). */
export interface OrderDraft {
  /** Company the sale belongs to; defaults to 1 when omitted. */
  companyId?: number;
  ts: number;
  method: PaymentMethod;
  totalCents: number;
  lines: Array<{
    itemId: number | null;
    name: string;
    image: string;
    unit: Unit;
    tint: string;
    priceCents: number;
    qtyMilli: number;
    amountCents: number;
    bulkPrice?: boolean;
    bulkMinQtyMilli?: number;
  }>;
}

export interface PosRepo {
  // --- lookups ---
  listCompanies(): Promise<Company[]>;
  listUnitTypes(): Promise<UnitType[]>;

  // --- items (always returned with their price tiers) ---
  /** Items, optionally including inactive and/or scoped to one company. */
  listItems(includeInactive?: boolean, companyId?: number): Promise<PricedItem[]>;
  getItem(id: number): Promise<PricedItem | null>;
  getItemByKey(key: string): Promise<PricedItem | null>;
  createItem(input: ItemInput): Promise<PricedItem>;
  updateItem(id: number, patch: ItemPatch): Promise<PricedItem>;
  setItemActive(id: number, active: boolean): Promise<void>;
  /** Replace *all* tiers for an item (the editor sends the full set). */
  setTiers(itemId: number, tiers: TierInput[]): Promise<void>;

  // --- orders ---
  /** Persist a pre-priced draft atomically and return the stored order. */
  persistOrder(draft: OrderDraft): Promise<Order>;
  getOrder(id: number): Promise<Order | null>;
  /** Orders with ts in [startMs, endMs), newest first; optionally one company. */
  listOrders(startMs: number, endMs: number, companyId?: number): Promise<Order[]>;
}
