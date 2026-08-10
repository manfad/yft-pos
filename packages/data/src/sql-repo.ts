import {
  type PosRepo,
  type ItemInput,
  type ItemPatch,
  type TierInput,
  type OrderDraft,
  type Company,
  type Credit,
  type DayClose,
  type Item,
  type PricedItem,
  type PriceTier,
  type UnitType,
  type Order,
  type OrderLine,
  type Unit,
  lineAmount,
  localDateStr,
  nextDateStr,
} from "@yf/core";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import type { SqlDriver } from "./driver.js";
import { makeDrizzle, type DrizzleDb } from "./drizzle.js";
import {
  companies,
  credits,
  dayCloses,
  items,
  orderItems,
  orders,
  outbox,
  priceTiers,
  settings,
  unitTypes,
} from "./schema.js";

// One PosRepo, driver-agnostic. Queries are built with Drizzle and executed
// through the SqlDriver (see drizzle.ts); swapping sql.js for tauri-plugin-sql /
// node:sqlite is just a different SqlDriver.

const toItem = (r: typeof items.$inferSelect): Item => ({
  id: r.id,
  key: r.key,
  name: r.name,
  image: r.image,
  unit: r.unit as Unit,
  priceCents: r.priceCents,
  active: r.active,
  tracksTail: r.tracksTail,
});

const toTier = (r: typeof priceTiers.$inferSelect): PriceTier => ({
  id: r.id,
  itemId: r.itemId,
  minQtyMilli: r.minQtyMilli,
  priceCents: r.priceCents,
});

/**
 * Hydrate a raw order_items row into a domain line: display fields come from
 * the joined item (items are only soft-deleted, so it's always there — the
 * fallbacks just keep a manually-tampered DB from crashing the till), and the
 * bulk-tier annotation is re-derived: a line was tier-priced when its stored
 * unit price matches a tier whose quantity threshold the line met.
 */
const toLine = (
  r: typeof orderItems.$inferSelect,
  item: typeof items.$inferSelect | null,
  tiers: PriceTier[],
): OrderLine => {
  const tier = tiers
    .filter((t) => t.minQtyMilli <= r.qtyMilli && t.priceCents === r.priceCents)
    .sort((a, b) => b.minQtyMilli - a.minQtyMilli)[0];
  return {
    id: r.id,
    itemId: r.itemId,
    name: item?.name ?? `Item #${r.itemId}`,
    image: item?.image ?? "",
    unit: (item?.unit ?? "each") as Unit,
    priceCents: r.priceCents,
    qtyMilli: r.qtyMilli,
    amountCents: lineAmount(r.priceCents, r.qtyMilli),
    tailCount: r.tailCount,
    bulkPrice: tier != null,
    ...(tier ? { bulkMinQtyMilli: tier.minQtyMilli } : {}),
  };
};

const toCredit = (r: typeof credits.$inferSelect): Credit => ({
  id: r.id,
  companyId: r.companyId,
  orderId: r.orderId,
  name: r.name,
  amountCents: r.amountCents,
  date: r.date,
  clearedAt: r.isClear ?? null,
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

  async listItems(includeInactive = false): Promise<PricedItem[]> {
    const rows = await this.dz
      .select()
      .from(items)
      .where(includeInactive ? undefined : eq(items.active, true))
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
        key: input.key,
        name: input.name,
        image: input.image ?? "",
        unit: input.unit ?? "each",
        priceCents: input.priceCents,
        tracksTail: input.tracksTail ?? false,
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
        priceCents: patch.priceCents ?? cur.priceCents,
        active: patch.active ?? cur.active,
        tracksTail: patch.tracksTail ?? cur.tracksTail,
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
          businessDate: draft.businessDate ?? localDateStr(draft.ts),
          totalCents: draft.totalCents,
          method: draft.method,
        })
        .returning({ id: orders.id });
      for (const l of draft.lines) {
        await this.dz.insert(orderItems).values({
          orderId: o!.id,
          itemId: l.itemId,
          priceCents: l.priceCents,
          qtyMilli: l.qtyMilli,
          tailCount: l.tailCount ?? 0,
        });
      }
      // A credit sale also records who owes it — one outstanding credit per order.
      if (draft.method === "Credit" && draft.creditorName) {
        await this.dz.insert(credits).values({
          companyId: draft.companyId ?? 1,
          orderId: o!.id,
          name: draft.creditorName,
          amountCents: draft.totalCents,
          date: draft.ts,
          isClear: null,
        });
      }
      return o!.id;
    });
    return (await this.getOrder(id))!;
  }

  // --- credits ---
  async listCredits(companyId?: number, opts?: { outstandingOnly?: boolean }): Promise<Credit[]> {
    const conds = [];
    if (companyId != null) conds.push(eq(credits.companyId, companyId));
    if (opts?.outstandingOnly) conds.push(isNull(credits.isClear));
    const rows = await this.dz
      .select()
      .from(credits)
      .where(and(...conds))
      .orderBy(desc(credits.date));
    return rows.map(toCredit);
  }

  async clearCreditsByName(name: string, clearedAt: number, companyId?: number): Promise<void> {
    const conds = [eq(credits.name, name), isNull(credits.isClear)];
    if (companyId != null) conds.push(eq(credits.companyId, companyId));
    await this.dz.update(credits).set({ isClear: clearedAt }).where(and(...conds));
  }

  async clearCredit(creditId: number, clearedAt: number): Promise<void> {
    await this.dz
      .update(credits)
      .set({ isClear: clearedAt })
      .where(and(eq(credits.id, creditId), isNull(credits.isClear)));
  }

  /** Map order_id -> creditor name for the given orders (only credit orders have one). */
  private async creditorNamesFor(orderIds: number[]): Promise<Map<number, string>> {
    if (orderIds.length === 0) return new Map();
    const rows = await this.dz
      .select()
      .from(credits)
      .where(inArray(credits.orderId, orderIds));
    const m = new Map<number, string>();
    for (const r of rows) if (!m.has(r.orderId)) m.set(r.orderId, r.name);
    return m;
  }

  private async linesFor(orderId: number): Promise<OrderLine[]> {
    const rows = await this.dz
      .select({ line: orderItems, item: items })
      .from(orderItems)
      .leftJoin(items, eq(orderItems.itemId, items.id))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id));
    if (rows.length === 0) return [];
    const itemIds = [...new Set(rows.map((r) => r.line.itemId))];
    const tierRows = await this.dz
      .select()
      .from(priceTiers)
      .where(inArray(priceTiers.itemId, itemIds));
    const tiersByItem = new Map<number, PriceTier[]>();
    for (const t of tierRows) {
      (tiersByItem.get(t.itemId) ?? tiersByItem.set(t.itemId, []).get(t.itemId)!).push(toTier(t));
    }
    return rows.map((r) => toLine(r.line, r.item, tiersByItem.get(r.line.itemId) ?? []));
  }

  async getOrder(id: number): Promise<Order | null> {
    const rows = await this.dz.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0]!;
    const name = r.method === "Credit" ? (await this.creditorNamesFor([id])).get(id) : undefined;
    return this.toOrder(r, await this.linesFor(id), name);
  }

  async listOrders(startMs: number, endMs: number, companyId?: number): Promise<Order[]> {
    const conds = [gte(orders.ts, startMs), lt(orders.ts, endMs)];
    if (companyId != null) conds.push(eq(orders.companyId, companyId));
    const rows = await this.dz
      .select()
      .from(orders)
      .where(and(...conds))
      .orderBy(desc(orders.ts));
    const names = await this.creditorNamesFor(rows.filter((r) => r.method === "Credit").map((r) => r.id));
    const result: Order[] = [];
    for (const r of rows) {
      result.push(this.toOrder(r, await this.linesFor(r.id), names.get(r.id)));
    }
    return result;
  }

  private toOrder(r: typeof orders.$inferSelect, lines: OrderLine[], creditorName?: string): Order {
    return {
      id: r.id,
      companyId: r.companyId,
      ts: r.ts,
      businessDate: r.businessDate ?? localDateStr(r.ts),
      method: r.method,
      totalCents: r.totalCents,
      items: lines,
      voidedAt: r.voidedAt ?? null,
      ...(creditorName ? { creditorName } : {}),
    };
  }

  async listOrdersByBusinessDate(fromDate: string, toDate: string, companyId?: number): Promise<Order[]> {
    const conds = [gte(orders.businessDate, fromDate), lte(orders.businessDate, toDate)];
    if (companyId != null) conds.push(eq(orders.companyId, companyId));
    const rows = await this.dz
      .select()
      .from(orders)
      .where(and(...conds))
      .orderBy(desc(orders.ts));
    const names = await this.creditorNamesFor(rows.filter((r) => r.method === "Credit").map((r) => r.id));
    const result: Order[] = [];
    for (const r of rows) {
      result.push(this.toOrder(r, await this.linesFor(r.id), names.get(r.id)));
    }
    return result;
  }

  async voidOrder(orderId: number, at: number): Promise<void> {
    await this.db.tx(async () => {
      await this.dz.update(orders).set({ voidedAt: at }).where(eq(orders.id, orderId));
      // A cancelled credit sale is no longer owed — drop its credit record.
      await this.dz.delete(credits).where(eq(credits.orderId, orderId));
    });
  }

  // --- business days (Close Day) ---
  private toDayClose(r: typeof dayCloses.$inferSelect): DayClose {
    return { id: r.id, companyId: r.companyId, businessDate: r.businessDate, closedAt: r.closedAt, auto: r.auto };
  }

  async getDayClose(businessDate: string, companyId = 1): Promise<DayClose | null> {
    const rows = await this.dz
      .select()
      .from(dayCloses)
      .where(and(eq(dayCloses.businessDate, businessDate), eq(dayCloses.companyId, companyId)))
      .limit(1);
    return rows.length ? this.toDayClose(rows[0]!) : null;
  }

  async closeDay(
    businessDate: string,
    opts: { companyId?: number; auto?: boolean; at?: number } = {},
  ): Promise<DayClose> {
    const companyId = opts.companyId ?? 1;
    if (await this.getDayClose(businessDate, companyId)) {
      throw new Error(`day ${businessDate} is already closed`);
    }
    const [row] = await this.dz
      .insert(dayCloses)
      .values({
        companyId,
        businessDate,
        closedAt: opts.at ?? Date.now(),
        auto: opts.auto ?? false,
      })
      .returning({ id: dayCloses.id });
    return (await this.getDayClose(businessDate, companyId)) ?? { id: row!.id, companyId, businessDate, closedAt: opts.at ?? Date.now(), auto: opts.auto ?? false };
  }

  async reopenDay(businessDate: string, companyId = 1): Promise<void> {
    const next = nextDateStr(businessDate);
    await this.db.tx(async () => {
      await this.dz
        .delete(dayCloses)
        .where(and(eq(dayCloses.businessDate, businessDate), eq(dayCloses.companyId, companyId)));
      // Sales pushed to the next business day by the close, but physically rung
      // up on this calendar day, come back to the reopened day. The calendar-day
      // check runs in JS — sql.js has no reliable 'localtime'.
      const pushed = await this.dz
        .select({ id: orders.id, ts: orders.ts })
        .from(orders)
        .where(and(eq(orders.businessDate, next), eq(orders.companyId, companyId)));
      const ids = pushed.filter((r) => localDateStr(r.ts) === businessDate).map((r) => r.id);
      if (ids.length) {
        await this.dz.update(orders).set({ businessDate }).where(inArray(orders.id, ids));
      }
    });
  }

  async listUnclosedDays(beforeDate: string, companyId?: number): Promise<string[]> {
    const rows = await this.db.all(
      `SELECT DISTINCT o.business_date AS d FROM orders o
       WHERE o.business_date < ?
         ${companyId != null ? "AND o.company_id = ?" : ""}
         AND NOT EXISTS (
           SELECT 1 FROM day_closes c
           WHERE c.business_date = o.business_date AND c.company_id = o.company_id
         )
       ORDER BY d ASC`,
      companyId != null ? [beforeDate, companyId] : [beforeDate],
    );
    return rows.map((r) => String(r.d));
  }

  // --- settings ---
  async getSetting(key: string): Promise<string | null> {
    const rows = await this.dz.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows.length ? rows[0]!.value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.dz
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  // --- outbox ---
  async queueEmail(input: {
    companyId?: number;
    businessDate: string;
    subject: string;
    body: string;
    attachmentName?: string;
    attachmentB64?: string;
  }): Promise<number> {
    const [row] = await this.dz
      .insert(outbox)
      .values({
        companyId: input.companyId ?? 1,
        businessDate: input.businessDate,
        subject: input.subject,
        body: input.body,
        attachmentName: input.attachmentName ?? null,
        attachmentB64: input.attachmentB64 ?? null,
        createdAt: Date.now(),
      })
      .returning({ id: outbox.id });
    return row!.id;
  }

  async listOutbox(businessDate?: string): Promise<
    Array<{
      id: number;
      companyId: number;
      businessDate: string;
      subject: string;
      attachmentName: string | null;
      createdAt: number;
      sentAt: number | null;
      attempts: number;
      lastError: string | null;
    }>
  > {
    const rows = await this.dz
      .select()
      .from(outbox)
      .where(businessDate != null ? eq(outbox.businessDate, businessDate) : undefined)
      .orderBy(desc(outbox.createdAt));
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      businessDate: r.businessDate,
      subject: r.subject,
      attachmentName: r.attachmentName ?? null,
      createdAt: r.createdAt,
      sentAt: r.sentAt ?? null,
      attempts: r.attempts,
      lastError: r.lastError ?? null,
    }));
  }
}
