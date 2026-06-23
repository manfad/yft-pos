import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { createOrder, computeStats, periodRange } from "@yf/core";
import { createSqlJsDriver, initRepo, SqlPosRepo } from "./index.js";

// End-to-end through real SQLite (sql.js in node): schema, seed, tiers, orders.

async function freshRepo(seedDemo = false): Promise<SqlPosRepo> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const driver = createSqlJsDriver(db as never);
  return initRepo(driver, {
    seedDemoOrders: seedDemo,
    now: new Date(2026, 5, 19),
    rng: () => 0.5,
  });
}

describe("SqlPosRepo over sql.js", () => {
  let repo: SqlPosRepo;
  beforeEach(async () => {
    repo = await freshRepo();
  });

  it("seeds the catalogue with tiers", async () => {
    const items = await repo.listItems();
    expect(items.length).toBe(10);
    const fish = items.find((i) => i.key === "tilapia")!;
    expect(fish.tiers).toHaveLength(1);
    expect(fish.tiers[0]).toMatchObject({ minQtyMilli: 10000, priceCents: 2300 });
  });

  it("prices an order with the tier discount and persists snapshots", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const order = await createOrder(repo, {
      method: "Cash",
      ts: 1000,
      lines: [{ itemId: fish.id, qtyMilli: 30000 }],
    });
    expect(order.totalCents).toBe(69000); // 30kg @ RM23 (>=10kg tier)
    expect(order.items[0]).toMatchObject({
      priceCents: 2300,
      qtyMilli: 30000,
      amountCents: 69000,
      bulkPrice: true,
      bulkMinQtyMilli: 10000,
    });

    // snapshot survives a later price change
    await repo.updateItem(fish.id, { priceCents: 9999 });
    const again = (await repo.getOrder(order.id))!;
    expect(again.items[0]!.priceCents).toBe(2300);
  });

  it("base price applies below the tier threshold", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const order = await createOrder(repo, {
      method: "QR",
      lines: [{ itemId: fish.id, qtyMilli: 2000 }],
    });
    expect(order.items[0]!.priceCents).toBe(2500); // RM25 base (below 10kg)
    expect(order.items[0]!.bulkPrice).toBe(false);
  });

  it("CRUD + soft delete hides items from the till", async () => {
    const created = await repo.createItem({ key: "lime", name: "Lime", priceCents: 300 });
    expect((await repo.listItems()).some((i) => i.key === "lime")).toBe(true);
    await repo.setItemActive(created.id, false);
    expect((await repo.listItems()).some((i) => i.key === "lime")).toBe(false);
    expect((await repo.listItems(true)).some((i) => i.key === "lime")).toBe(true);
  });

  it("editing tiers replaces the whole set", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    await repo.setTiers(fish.id, [
      { minQtyMilli: 10000, priceCents: 1700 },
      { minQtyMilli: 50000, priceCents: 1200 },
    ]);
    const updated = (await repo.getItem(fish.id))!;
    expect(updated.tiers).toHaveLength(2);
    expect(updated.tiers.map((t) => t.priceCents)).toEqual([1700, 1200]);
  });

  it("rejects negative prices before persistence", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    await expect(
      repo.createItem({ key: "bad-price", name: "Bad Price", priceCents: -1 }),
    ).rejects.toThrow("priceCents");
    await expect(repo.updateItem(fish.id, { priceCents: -1 })).rejects.toThrow("priceCents");
    await expect(
      repo.setTiers(fish.id, [{ minQtyMilli: 10000, priceCents: -1 }]),
    ).rejects.toThrow("tier priceCents");
  });

  it("computes period stats from persisted orders", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const now = new Date(2026, 5, 19, 12).getTime();
    await createOrder(repo, { method: "Cash", ts: now, lines: [{ itemId: fish.id, qtyMilli: 1000 }] });
    await createOrder(repo, { method: "QR", ts: now, lines: [{ itemId: fish.id, qtyMilli: 1000 }] });
    const [s, e] = periodRange("today", new Date(2026, 5, 19, 15));
    const orders = await repo.listOrders(s, e);
    const stats = computeStats(orders, "today");
    expect(stats.count).toBe(2);
    expect(stats.totalCents).toBe(5000); // 2 x RM25
    expect(stats.byMethod.Cash.count).toBe(1);
    expect(stats.byMethod.QR.count).toBe(1);
  });
});

describe("demo seeding", () => {
  it("produces orders for the Sales report", async () => {
    const repo = await freshRepo(true);
    const orders = await repo.listOrders(0, Number.MAX_SAFE_INTEGER);
    expect(orders.length).toBeGreaterThan(0);
  });
});

describe("bulk-pricing backfill migration", () => {
  it("re-derives bulk_price/min_qty for legacy rows missing them", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    const repo = await initRepo(driver, { now: new Date(2026, 5, 19) });
    const fish = (await repo.getItemByKey("tilapia"))!; // tier: >=10kg -> RM23

    // Simulate a pre-migration order line: discounted price kept, but the bulk
    // columns left at their backfilled defaults (0 / NULL).
    await driver.run("INSERT INTO orders (company_id, ts, total_cents, method) VALUES (1, 1000, 25300, 'QR')");
    const oid = Number(
      (await driver.all("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0]!.id,
    );
    await driver.run(
      `INSERT INTO order_items
       (order_id, item_id, name, image, unit, tint, price_cents, qty_milli, bulk_price, bulk_min_qty_milli)
       VALUES (?, ?, 'Ikan Tilapia', '', 'kg', '#fff', 2300, 11000, 0, NULL)`,
      [oid, fish.id],
    );

    // Re-run init (idempotent migrations) to apply the backfill.
    await initRepo(driver, { now: new Date(2026, 5, 19) });

    const order = (await repo.getOrder(oid))!;
    expect(order.items[0]).toMatchObject({ bulkPrice: true, bulkMinQtyMilli: 10000 });
  });

  it("leaves below-threshold (base-price) lines untouched", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    const repo = await initRepo(driver, { now: new Date(2026, 5, 19) });
    const fish = (await repo.getItemByKey("tilapia"))!;

    await driver.run("INSERT INTO orders (company_id, ts, total_cents, method) VALUES (1, 1000, 5000, 'Cash')");
    const oid = Number(
      (await driver.all("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0]!.id,
    );
    await driver.run(
      `INSERT INTO order_items
       (order_id, item_id, name, image, unit, tint, price_cents, qty_milli, bulk_price, bulk_min_qty_milli)
       VALUES (?, ?, 'Ikan Tilapia', '', 'kg', '#fff', 2500, 2000, 0, NULL)`,
      [oid, fish.id],
    );

    await initRepo(driver, { now: new Date(2026, 5, 19) });

    const order = (await repo.getOrder(oid))!;
    expect(order.items[0]!.bulkPrice).toBe(false);
    expect(order.items[0]!.bulkMinQtyMilli).toBeUndefined();
  });
});
