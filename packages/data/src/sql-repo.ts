import {
  type PosRepo,
  type ItemInput,
  type ItemPatch,
  type TierInput,
  type OrderDraft,
  type Company,
  type Item,
  type PricedItem,
  type PriceTier,
  type UnitType,
  type Order,
  type OrderLine,
  type Unit,
  lineAmount,
} from "@yf/core";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { SqlDriver } from "./driver.js";
import { makeDrizzle, type DrizzleDb } from "./drizzle.js";
import { companies, items, orderItems, orders, priceTiers, unitTypes } from "./schema.js";

// One PosRepo, driver-agnostic. Queries are built with Drizzle and executed
// through the SqlDriver (see drizzle.ts); swapping sql.js for tauri-plugin-sql /
// node:sqlite is just a different SqlDriver.

const toItem = (r: typeof items.$inferSelect): Item => ({
  id: r.id,
  companyId: r.companyId,
  key: r.key,
  name: r.name,
  image: r.image,
  unit: r.unit as Unit,
  tint: r.tint,
  priceCents: r.priceCents,
  active: r.active,
});

const toTier = (r: typeof priceTiers.$inferSelect): PriceTier => ({
  id: r.id,
  itemId: r.itemId,
  minQtyMilli: r.minQtyMilli,
  priceCents: r.priceCents,
});

const toLine = (r: typeof orderItems.$inferSelect): OrderLine => ({
  id: r.id,
  itemId: r.itemId,
  name: r.name,
  image: r.image,
  unit: r.unit as Unit,
  tint: r.tint,
  priceCents: r.priceCents,
  qtyMilli: r.qtyMilli,
  amountCents: lineAmount(r.priceCents, r.qtyMilli),
  bulkPrice: r.bulkPrice,
  ...(r.bulkMinQtyMilli == null ? {} : { bulkMinQtyMilli: r.bulkMinQtyMilli }),
});

function assertCents(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative whole-cent amount`);
  }
}

function assertPositiveMilli(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive milli-unit amount`);
  }
}

export class SqlPosRepo implements PosRepo {
  private readonly dz: DrizzleDb;

  constructor(private readonly db: SqlDriver) {
    this.dz = makeDrizzle(db);
  }

  // --- lookups ---
  async listCompanies(): Promise<Company[]> {
    return this.dz.select().from(companies).orderBy(asc(companies.id));
  }

  async listUnitTypes(): Promise<UnitType[]> {
    return this.dz.select().from(unitTypes).orderBy(asc(unitTypes.id));
  }

  // --- items ---
  private async attachTiers(list: Item[]): Promise<PricedItem[]> {
    if (list.length === 0) return [];
    const ids = list.map((i) => i.id);
    const tierRows = await this.dz
      .select()
      .from(priceTiers)
      .where(inArray(priceTiers.itemId, ids))
      .orderBy(asc(priceTiers.minQtyMilli));
    const byItem = new Map<number, PriceTier[]>();
    for (const r of tierRows) {
      const t = toTier(r);
      (byItem.get(t.itemId) ?? byItem.set(t.itemId, []).get(t.itemId)!).push(t);
    }
    return list.map((i) => ({ ...i, tiers: byItem.get(i.id) ?? [] }));
  }

  async listItems(includeInactive = false, companyId?: number): Promise<PricedItem[]> {
    const conds = [];
    if (!includeInactive) conds.push(eq(items.active, true));
    if (companyId != null) conds.push(eq(items.companyId, companyId));
    const rows = await this.dz
      .select()
      .from(items)
      .where(and(...conds))
      .orderBy(asc(items.id));
    return this.attachTiers(rows.map(toItem));
  }

  async getItem(id: number): Promise<PricedItem | null> {
    const rows = await this.dz.select().from(items).where(eq(items.id, id)).limit(1);
    if (rows.length === 0) return null;
    return (await this.attachTiers([toItem(rows[0]!)]))[0]!;
  }

  async getItemByKey(key: string): Promise<PricedItem | null> {
    const rows = await this.dz.select().from(items).where(eq(items.key, key)).limit(1);
    if (rows.length === 0) return null;
    return (await this.attachTiers([toItem(rows[0]!)]))[0]!;
  }

  async createItem(input: ItemInput): Promise<PricedItem> {
    assertCents(input.priceCents, "priceCents");
    const [row] = await this.dz
      .insert(items)
      .values({
        companyId: input.companyId ?? 1,
        key: input.key,
        name: input.name,
        image: input.image ?? "",
        unit: input.unit ?? "each",
        tint: input.tint ?? "#eee",
        priceCents: input.priceCents,
      })
      .returning({ id: items.id });
    return (await this.getItem(row!.id))!;
  }

  async updateItem(id: number, patch: ItemPatch): Promise<PricedItem> {
    const cur = await this.getItem(id);
    if (!cur) throw new Error("item not found");
    if (patch.priceCents != null) assertCents(patch.priceCents, "priceCents");
    await this.dz
      .update(items)
      .set({
        name: patch.name ?? cur.name,
        image: patch.image ?? cur.image,
        unit: patch.unit ?? cur.unit,
        tint: patch.tint ?? cur.tint,
        priceCents: patch.priceCents ?? cur.priceCents,
        active: patch.active ?? cur.active,
      })
      .where(eq(items.id, id));
    return (await this.getItem(id))!;
  }

  async setItemActive(id: number, active: boolean): Promise<void> {
    await this.dz.update(items).set({ active }).where(eq(items.id, id));
  }

  async setTiers(itemId: number, tiers: TierInput[]): Promise<void> {
    for (const t of tiers) {
      assertPositiveMilli(t.minQtyMilli, "tier minQtyMilli");
      assertCents(t.priceCents, "tier priceCents");
    }
    await this.db.tx(async () => {
      await this.dz.delete(priceTiers).where(eq(priceTiers.itemId, itemId));
      for (const t of tiers) {
        await this.dz
          .insert(priceTiers)
          .values({ itemId, minQtyMilli: t.minQtyMilli, priceCents: t.priceCents });
      }
    });
  }

  // --- orders ---
  async persistOrder(draft: OrderDraft): Promise<Order> {
    assertCents(draft.totalCents, "order totalCents");
    for (const l of draft.lines) {
      assertCents(l.priceCents, "line priceCents");
      assertPositiveMilli(l.qtyMilli, "line qtyMilli");
    }
    const id = await this.db.tx(async () => {
      const [o] = await this.dz
        .insert(orders)
        .values({
          companyId: draft.companyId ?? 1,
          ts: draft.ts,
          totalCents: draft.totalCents,
          method: draft.method,
        })
        .returning({ id: orders.id });
      for (const l of draft.lines) {
        await this.dz.insert(orderItems).values({
          orderId: o!.id,
          itemId: l.itemId,
          name: l.name,
          image: l.image,
          unit: l.unit,
          tint: l.tint,
          priceCents: l.priceCents,
          qtyMilli: l.qtyMilli,
          bulkPrice: l.bulkPrice ?? false,
          bulkMinQtyMilli: l.bulkMinQtyMilli ?? null,
        });
      }
      return o!.id;
    });
    return (await this.getOrder(id))!;
  }

  private async linesFor(orderId: number): Promise<OrderLine[]> {
    const rows = await this.dz
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));
    return rows.map(toLine);
  }

  async getOrder(id: number): Promise<Order | null> {
    const rows = await this.dz.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (rows.length === 0) return null;
    return this.toOrder(rows[0]!, await this.linesFor(id));
  }

  async listOrders(startMs: number, endMs: number, companyId?: number): Promise<Order[]> {
    const conds = [gte(orders.ts, startMs), lt(orders.ts, endMs)];
    if (companyId != null) conds.push(eq(orders.companyId, companyId));
    const rows = await this.dz
      .select()
      .from(orders)
      .where(and(...conds))
      .orderBy(desc(orders.ts));
    const result: Order[] = [];
    for (const r of rows) {
      result.push(this.toOrder(r, await this.linesFor(r.id)));
    }
    return result;
  }

  private toOrder(r: typeof orders.$inferSelect, lines: OrderLine[]): Order {
    return {
      id: r.id,
      companyId: r.companyId,
      ts: r.ts,
      method: r.method,
      totalCents: r.totalCents,
      items: lines,
    };
  }
}
