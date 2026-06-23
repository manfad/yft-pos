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
  type PaymentMethod,
  lineAmount,
} from "@yf/core";
import type { Row, SqlDriver, SqlValue } from "./driver.js";

// One PosRepo, driver-agnostic. All SQL lives here; swapping sql.js for
// tauri-plugin-sql / node:sqlite is just a different SqlDriver.

const itemFromRow = (r: Row): Item => ({
  id: Number(r.id),
  companyId: Number(r.company_id ?? 1),
  key: String(r.key),
  name: String(r.name),
  image: String(r.image ?? ""),
  unit: String(r.unit) as Unit,
  tint: String(r.tint ?? "#eee"),
  priceCents: Number(r.price_cents),
  active: Number(r.active) === 1,
});

const tierFromRow = (r: Row): PriceTier => ({
  id: Number(r.id),
  itemId: Number(r.item_id),
  minQtyMilli: Number(r.min_qty_milli),
  priceCents: Number(r.price_cents),
});

const lineFromRow = (r: Row): OrderLine => ({
  id: Number(r.id),
  itemId: r.item_id == null ? null : Number(r.item_id),
  name: String(r.name),
  image: String(r.image ?? ""),
  unit: String(r.unit) as Unit,
  tint: String(r.tint ?? "#eee"),
  priceCents: Number(r.price_cents),
  qtyMilli: Number(r.qty_milli),
  amountCents: lineAmount(Number(r.price_cents), Number(r.qty_milli)),
  bulkPrice: Number(r.bulk_price ?? 0) === 1,
  ...(r.bulk_min_qty_milli == null ? {} : { bulkMinQtyMilli: Number(r.bulk_min_qty_milli) }),
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
  constructor(private readonly db: SqlDriver) {}

  // --- lookups ---
  async listCompanies(): Promise<Company[]> {
    const rows = await this.db.all("SELECT * FROM companies ORDER BY id");
    return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
  }

  async listUnitTypes(): Promise<UnitType[]> {
    const rows = await this.db.all("SELECT * FROM unit_types ORDER BY id");
    return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }));
  }

  // --- items ---
  private async attachTiers(items: Item[]): Promise<PricedItem[]> {
    if (items.length === 0) return [];
    const ids = items.map((i) => i.id);
    const placeholders = ids.map(() => "?").join(",");
    const tierRows = await this.db.all(
      `SELECT * FROM price_tiers WHERE item_id IN (${placeholders}) ORDER BY min_qty_milli`,
      ids as SqlValue[],
    );
    const byItem = new Map<number, PriceTier[]>();
    for (const r of tierRows) {
      const t = tierFromRow(r);
      (byItem.get(t.itemId) ?? byItem.set(t.itemId, []).get(t.itemId)!).push(t);
    }
    return items.map((i) => ({ ...i, tiers: byItem.get(i.id) ?? [] }));
  }

  async listItems(includeInactive = false, companyId?: number): Promise<PricedItem[]> {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (!includeInactive) where.push("active = 1");
    if (companyId != null) {
      where.push("company_id = ?");
      params.push(companyId);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await this.db.all(`SELECT * FROM items ${clause} ORDER BY id`, params);
    return this.attachTiers(rows.map(itemFromRow));
  }

  async getItem(id: number): Promise<PricedItem | null> {
    const rows = await this.db.all("SELECT * FROM items WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return (await this.attachTiers([itemFromRow(rows[0]!)]))[0]!;
  }

  async getItemByKey(key: string): Promise<PricedItem | null> {
    const rows = await this.db.all("SELECT * FROM items WHERE key = ?", [key]);
    if (rows.length === 0) return null;
    return (await this.attachTiers([itemFromRow(rows[0]!)]))[0]!;
  }

  async createItem(input: ItemInput): Promise<PricedItem> {
    assertCents(input.priceCents, "priceCents");
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO items (company_id, key, name, image, unit, tint, price_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.companyId ?? 1,
        input.key,
        input.name,
        input.image ?? "",
        input.unit ?? "each",
        input.tint ?? "#eee",
        input.priceCents,
      ],
    );
    return (await this.getItem(lastInsertRowid))!;
  }

  async updateItem(id: number, patch: ItemPatch): Promise<PricedItem> {
    const cur = await this.getItem(id);
    if (!cur) throw new Error("item not found");
    if (patch.priceCents != null) assertCents(patch.priceCents, "priceCents");
    await this.db.run(
      `UPDATE items SET name = ?, image = ?, unit = ?, tint = ?,
       price_cents = ?, active = ? WHERE id = ?`,
      [
        patch.name ?? cur.name,
        patch.image ?? cur.image,
        patch.unit ?? cur.unit,
        patch.tint ?? cur.tint,
        patch.priceCents ?? cur.priceCents,
        (patch.active ?? cur.active) ? 1 : 0,
        id,
      ],
    );
    return (await this.getItem(id))!;
  }

  async setItemActive(id: number, active: boolean): Promise<void> {
    await this.db.run("UPDATE items SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
  }

  async setTiers(itemId: number, tiers: TierInput[]): Promise<void> {
    for (const t of tiers) {
      assertPositiveMilli(t.minQtyMilli, "tier minQtyMilli");
      assertCents(t.priceCents, "tier priceCents");
    }
    await this.db.tx(async () => {
      await this.db.run("DELETE FROM price_tiers WHERE item_id = ?", [itemId]);
      for (const t of tiers) {
        await this.db.run(
          "INSERT INTO price_tiers (item_id, min_qty_milli, price_cents) VALUES (?, ?, ?)",
          [itemId, t.minQtyMilli, t.priceCents],
        );
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
      const { lastInsertRowid } = await this.db.run(
        "INSERT INTO orders (company_id, ts, total_cents, method) VALUES (?, ?, ?, ?)",
        [draft.companyId ?? 1, draft.ts, draft.totalCents, draft.method],
      );
      for (const l of draft.lines) {
        await this.db.run(
          `INSERT INTO order_items
           (order_id, item_id, name, image, unit, tint, price_cents, qty_milli, bulk_price, bulk_min_qty_milli)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            lastInsertRowid,
            l.itemId,
            l.name,
            l.image,
            l.unit,
            l.tint,
            l.priceCents,
            l.qtyMilli,
            l.bulkPrice ? 1 : 0,
            l.bulkMinQtyMilli ?? null,
          ],
        );
      }
      return lastInsertRowid;
    });
    return (await this.getOrder(id))!;
  }

  private async linesFor(orderId: number): Promise<OrderLine[]> {
    const rows = await this.db.all(
      "SELECT * FROM order_items WHERE order_id = ? ORDER BY id",
      [orderId],
    );
    return rows.map(lineFromRow);
  }

  async getOrder(id: number): Promise<Order | null> {
    const rows = await this.db.all("SELECT * FROM orders WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return this.orderFromRow(rows[0]!, await this.linesFor(id));
  }

  async listOrders(startMs: number, endMs: number, companyId?: number): Promise<Order[]> {
    const rows = await this.db.all(
      `SELECT * FROM orders WHERE ts >= ? AND ts < ?${
        companyId != null ? " AND company_id = ?" : ""
      } ORDER BY ts DESC`,
      companyId != null ? [startMs, endMs, companyId] : [startMs, endMs],
    );
    const orders: Order[] = [];
    for (const r of rows) {
      orders.push(this.orderFromRow(r, await this.linesFor(Number(r.id))));
    }
    return orders;
  }

  private orderFromRow(r: Row, items: OrderLine[]): Order {
    return {
      id: Number(r.id),
      companyId: Number(r.company_id ?? 1),
      ts: Number(r.ts),
      method: String(r.method) as PaymentMethod,
      totalCents: Number(r.total_cents),
      items,
    };
  }
}
