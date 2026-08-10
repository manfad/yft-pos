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

  it("backfills tracks_tail when the column is first added to an existing DB", async () => {
    // Simulate a pre-tracks_tail database: an items table without the column,
    // already populated, so the seed block won't run on init.
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    await driver.run(
      `CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL DEFAULT 1,
        key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT 'each', tint TEXT NOT NULL DEFAULT '#eee',
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0), active INTEGER NOT NULL DEFAULT 1)`,
    );
    await driver.run("INSERT INTO items (key, name, unit, price_cents) VALUES ('tilapia','Ikan Tilapia','kg',2500)");
    await driver.run("INSERT INTO items (key, name, unit, price_cents) VALUES ('fresh_milk_1l','Fresh Milk 1 L','bottle',680)");

    const r = await initRepo(driver);
    expect((await r.getItemByKey("tilapia"))!.tracksTail).toBe(true);
    expect((await r.getItemByKey("fresh_milk_1l"))!.tracksTail).toBe(false);
  });

  it("widens the orders.method CHECK so Credit works on a pre-Credit DB", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    // Old orders table: CHECK without 'Credit'. CREATE TABLE IF NOT EXISTS in init
    // won't replace it, so the migration must rebuild it.
    await driver.run(
      `CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL DEFAULT 1,
        ts INTEGER NOT NULL, total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        method TEXT NOT NULL CHECK (method IN ('Cash','Bank','QR')))`,
    );
    const r = await initRepo(driver);
    const fish = (await r.getItemByKey("tilapia"))!;
    const order = await createOrder(r, {
      method: "Credit", creditorName: "Pak Abu", lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    expect(order.method).toBe("Credit");
    expect(await r.listCredits(1, { outstandingOnly: true })).toHaveLength(1);
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

  it("seeds tracksTail and round-trips a tail count, independent of qty", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    expect(fish.tracksTail).toBe(true); // fish/chicken are seeded as tail-tracking
    const milk = (await repo.getItemByKey("fresh_milk_1l"))!;
    expect(milk.tracksTail).toBe(false);

    const order = await createOrder(repo, {
      method: "Cash",
      ts: 1000,
      lines: [
        { itemId: fish.id, qtyMilli: 12000, tailCount: 38 },
        { itemId: milk.id, qtyMilli: 2000, tailCount: 99 }, // ignored: not tracksTail
      ],
    });
    const stored = (await repo.getOrder(order.id))!;
    const fishLine = stored.items.find((l) => l.itemId === fish.id)!;
    const milkLine = stored.items.find((l) => l.itemId === milk.id)!;
    expect(fishLine).toMatchObject({ qtyMilli: 12000, tailCount: 38 });
    expect(milkLine.tailCount).toBe(0); // non-tracking item never stores a tail
  });

  it("records, lists and clears credits for a pay-later sale", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const o1 = await createOrder(repo, {
      method: "Credit", ts: 1000, creditorName: "Pak Abu",
      lines: [{ itemId: fish.id, qtyMilli: 2000, tailCount: 2 }],
    });
    const o2 = await createOrder(repo, {
      method: "Credit", ts: 2000, creditorName: "Pak Abu",
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    // A Cash sale never produces a credit.
    await createOrder(repo, { method: "Cash", ts: 3000, lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }] });

    // Credit orders carry the creditor name; cash orders don't.
    expect(o1.creditorName).toBe("Pak Abu");
    expect((await repo.getOrder(o1.id))!.creditorName).toBe("Pak Abu");
    const listed = await repo.listOrders(0, 9999, 1);
    expect(listed.find((o) => o.method === "Cash")!.creditorName).toBeUndefined();

    const open = await repo.listCredits(1, { outstandingOnly: true });
    expect(open).toHaveLength(2);
    expect(open.map((c) => c.orderId).sort()).toEqual([o1.id, o2.id].sort());
    expect(open.every((c) => c.name === "Pak Abu" && c.clearedAt === null)).toBe(true);
    expect(open.find((c) => c.orderId === o1.id)!.amountCents).toBe(o1.totalCents);

    await repo.clearCreditsByName("Pak Abu", 9999, 1);
    expect(await repo.listCredits(1, { outstandingOnly: true })).toHaveLength(0);
    const all = await repo.listCredits(1);
    expect(all).toHaveLength(2);
    expect(all.every((c) => c.clearedAt === 9999)).toBe(true);
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

describe("Close Day, void, settings, outbox", () => {
  let repo: SqlPosRepo;
  beforeEach(async () => {
    repo = await freshRepo();
  });

  async function sell(businessDate: string, ts: number): Promise<number> {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const o = await createOrder(repo, {
      method: "Cash",
      ts,
      businessDate,
      companyId: 1,
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    return o.id;
  }

  it("stamps business_date on orders (default: ts's local day)", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const ts = new Date(2026, 6, 13, 9, 0).getTime();
    const o = await createOrder(repo, {
      method: "Cash",
      ts,
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    expect(o.businessDate).toBe("2026-07-13");
    expect(o.voidedAt).toBeNull();
  });

  it("closes a day once and refuses a second close", async () => {
    const c = await repo.closeDay("2026-07-13", { companyId: 1, at: 123 });
    expect(c.businessDate).toBe("2026-07-13");
    expect(c.auto).toBe(false);
    await expect(repo.closeDay("2026-07-13", { companyId: 1 })).rejects.toThrow(/already closed/);
  });

  it("reopenDay pulls same-calendar-day pushed sales back", async () => {
    const dayTs = new Date(2026, 6, 13, 12, 0).getTime();
    await sell("2026-07-13", dayTs);
    await repo.closeDay("2026-07-13", { companyId: 1 });
    // Sale after close, same calendar day -> stamped to the 14th.
    const lateTs = new Date(2026, 6, 13, 17, 0).getTime();
    const pushedId = await sell("2026-07-14", lateTs);
    // A genuine next-day sale must NOT be pulled back on reopen.
    const nextDayId = await sell("2026-07-14", new Date(2026, 6, 14, 9, 0).getTime());

    await repo.reopenDay("2026-07-13", 1);
    expect(await repo.getDayClose("2026-07-13", 1)).toBeNull();
    expect((await repo.getOrder(pushedId))!.businessDate).toBe("2026-07-13");
    expect((await repo.getOrder(nextDayId))!.businessDate).toBe("2026-07-14");
  });

  it("lists unclosed past days with orders", async () => {
    await sell("2026-07-11", new Date(2026, 6, 11, 10, 0).getTime());
    await sell("2026-07-12", new Date(2026, 6, 12, 10, 0).getTime());
    await repo.closeDay("2026-07-11", { companyId: 1 });
    expect(await repo.listUnclosedDays("2026-07-13", 1)).toEqual(["2026-07-12"]);
  });

  it("voidOrder excludes the sale from stats and drops its credit", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const o = await createOrder(repo, {
      method: "Credit",
      creditorName: "Ah Seng",
      ts: new Date(2026, 6, 13, 10, 0).getTime(),
      businessDate: "2026-07-13",
      lines: [{ itemId: fish.id, qtyMilli: 2000, tailCount: 2 }],
    });
    expect((await repo.listCredits(1, { outstandingOnly: true })).length).toBe(1);

    await repo.voidOrder(o.id, Date.now());
    const voided = (await repo.getOrder(o.id))!;
    expect(voided.voidedAt).not.toBeNull();
    expect((await repo.listCredits(1, { outstandingOnly: true })).length).toBe(0);

    const day = await repo.listOrdersByBusinessDate("2026-07-13", "2026-07-13", 1);
    expect(day.length).toBe(1); // still listed (marked void) ...
    expect(computeStats(day, "today").totalCents).toBe(0); // ... but earns nothing
  });

  it("settings upsert and outbox queue round-trip", async () => {
    expect(await repo.getSetting("pin")).toBeNull();
    await repo.setSetting("pin", "1234");
    await repo.setSetting("pin", "9999");
    expect(await repo.getSetting("pin")).toBe("9999");

    const id = await repo.queueEmail({
      businessDate: "2026-07-13",
      subject: "Daily sales",
      body: "hello",
      attachmentName: "sales.xlsx",
      attachmentB64: "AAAA",
    });
    const rows = await repo.listOutbox("2026-07-13");
    expect(rows[0]!.id).toBe(id);
    expect(rows[0]!.sentAt).toBeNull();
  });
});
