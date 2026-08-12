import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { createOrder, computeStats, periodRange, type Order } from "@yf/core";
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

  it("setItemOrder reorders the catalogue, and new items land last", async () => {
    const a = await repo.createItem({ key: "order-a", name: "A", priceCents: 100 });
    const b = await repo.createItem({ key: "order-b", name: "B", priceCents: 100 });
    const c = await repo.createItem({ key: "order-c", name: "C", priceCents: 100 });

    await repo.setItemOrder([c.id, b.id, a.id]);
    const reordered = (await repo.listItems()).filter((i) => [a.id, b.id, c.id].includes(i.id));
    expect(reordered.map((i) => i.id)).toEqual([c.id, b.id, a.id]);

    const d = await repo.createItem({ key: "order-d", name: "D", priceCents: 100 });
    const withD = (await repo.listItems()).filter((i) => [a.id, b.id, c.id, d.id].includes(i.id));
    expect(withD.map((i) => i.id)).toEqual([c.id, b.id, a.id, d.id]);
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

describe("slim-schema migration", () => {
  it("rebuilds legacy items/order_items tables and re-links snapshot lines by name", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    // A populated pre-slim DB: items with company_id/tint, order_items with the
    // per-line snapshots, no tail_count yet, and one line whose item link was
    // lost (NULL item_id) but whose name still matches the catalogue.
    await driver.run(
      `CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL DEFAULT 1,
        key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT 'each', tint TEXT NOT NULL DEFAULT '#eee',
        price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1,
        tracks_tail INTEGER NOT NULL DEFAULT 0)`,
    );
    await driver.run(
      "INSERT INTO items (key, name, unit, price_cents, tracks_tail) VALUES ('tilapia','Ikan Tilapia','kg',2500,1)",
    );
    await driver.run(
      `CREATE TABLE order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
        item_id INTEGER, name TEXT NOT NULL, image TEXT NOT NULL DEFAULT '',
        unit TEXT NOT NULL DEFAULT 'each', tint TEXT NOT NULL DEFAULT '#eee',
        price_cents INTEGER NOT NULL, qty_milli INTEGER NOT NULL,
        bulk_price INTEGER NOT NULL DEFAULT 0, bulk_min_qty_milli INTEGER)`,
    );
    await driver.run(
      "INSERT INTO order_items (order_id, item_id, name, price_cents, qty_milli) VALUES (1, 1, 'Ikan Tilapia', 2500, 2000)",
    );
    await driver.run(
      "INSERT INTO order_items (order_id, item_id, name, price_cents, qty_milli) VALUES (1, NULL, 'Ikan Tilapia', 2300, 11000)",
    );

    await initRepo(driver);

    const itemCols = (await driver.all("PRAGMA table_info(items)")).map((c) => String(c.name));
    expect(itemCols).not.toContain("tint");
    expect(itemCols).not.toContain("company_id");
    const lineCols = (await driver.all("PRAGMA table_info(order_items)")).map((c) => String(c.name));
    expect(lineCols).toEqual(["id", "order_id", "item_id", "price_cents", "qty_milli", "tail_count"]);
    const lines = await driver.all("SELECT item_id, tail_count FROM order_items ORDER BY id");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => Number(l.item_id) === 1 && Number(l.tail_count) === 0)).toBe(true);
  });
});

describe("bulk-tier annotation (derived at read time)", () => {
  it("marks a line bulk when its price matches a tier whose threshold the qty met", async () => {
    const repo = await freshRepo();
    const fish = (await repo.getItemByKey("tilapia"))!; // tier: >=10kg -> RM23
    const order = await createOrder(repo, {
      method: "QR", ts: 1000, lines: [{ itemId: fish.id, qtyMilli: 11000 }],
    });
    expect((await repo.getOrder(order.id))!.items[0]).toMatchObject({
      bulkPrice: true,
      bulkMinQtyMilli: 10000,
    });
  });

  it("leaves below-threshold (base-price) lines unannotated", async () => {
    const repo = await freshRepo();
    const fish = (await repo.getItemByKey("tilapia"))!;
    const order = await createOrder(repo, {
      method: "Cash", ts: 1000, lines: [{ itemId: fish.id, qtyMilli: 2000 }],
    });
    const line = (await repo.getOrder(order.id))!.items[0]!;
    expect(line.bulkPrice).toBe(false);
    expect(line.bulkMinQtyMilli).toBeUndefined();
  });
});

describe("invoice numbers", () => {
  let repo: SqlPosRepo;
  beforeEach(async () => {
    repo = await freshRepo();
  });

  async function sell(businessDate: string, ts: number): Promise<Order> {
    const fish = (await repo.getItemByKey("tilapia"))!;
    return createOrder(repo, {
      method: "Cash",
      ts,
      businessDate,
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
  }

  it("runs from MM-1000 within a business month and restarts the next month", async () => {
    expect((await sell("2026-08-10", 1000)).invNo).toBe("08-1000");
    expect((await sell("2026-08-10", 2000)).invNo).toBe("08-1001");
    expect((await sell("2026-08-31", 3000)).invNo).toBe("08-1002");
    // September numbers itself from scratch ...
    expect((await sell("2026-09-01", 4000)).invNo).toBe("09-1000");
    expect((await sell("2026-09-02", 5000)).invNo).toBe("09-1001");
    // ... and a late August sale carries on where August left off.
    expect((await sell("2026-08-12", 6000)).invNo).toBe("08-1003");
  });

  it("stamps the number once — reads, and a void, never change it", async () => {
    const order = await sell("2026-08-10", 1000);
    expect((await repo.getOrder(order.id))!.invNo).toBe("08-1000");

    const voided = await sell("2026-08-10", 2000);
    expect(voided.invNo).toBe("08-1001");
    await repo.voidOrder(voided.id, Date.now());
    expect((await repo.getOrder(voided.id))!.invNo).toBe("08-1001");

    // The cancelled number is spent: the next sale takes max + 1, leaving a gap.
    expect((await sell("2026-08-10", 3000)).invNo).toBe("08-1002");
  });

  it("puts the credited order's number on its credit row", async () => {
    const fish = (await repo.getItemByKey("tilapia"))!;
    const order = await createOrder(repo, {
      method: "Credit",
      creditorName: "Pak Abu",
      ts: 1000,
      businessDate: "2026-08-10",
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    const [credit] = await repo.listCredits(1, { outstandingOnly: true });
    expect(credit).toMatchObject({ orderId: order.id, invNo: order.invNo });
  });

  it("leaves pre-existing orders unnumbered — MM-1000 starts with the first new sale", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    const driver = createSqlJsDriver(db as never);
    // A pre-inv_no database: business dates already stamped and the current
    // method CHECK, so nothing rebuilds the table before inv_no is added.
    await driver.run(
      `CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL DEFAULT 1,
        ts INTEGER NOT NULL, business_date TEXT,
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        method TEXT NOT NULL CHECK (method IN ('Cash','Bank','QR','Credit')),
        voided_at INTEGER)`,
    );
    const existing = ["2026-08-09", "2026-09-02", "2026-08-10"];
    for (const [index, businessDate] of existing.entries()) {
      await driver.run(
        "INSERT INTO orders (ts, business_date, total_cents, method) VALUES (?, ?, ?, 'Cash')",
        [1000 + index, businessDate, 2500],
      );
    }

    const repo = await initRepo(driver);

    // Sales from before the update are never renumbered (receipts were already
    // printed with the order id) — they display the id and stay NULL in the DB.
    const rows = await driver.all("SELECT inv_no FROM orders ORDER BY id");
    expect(rows.map((r) => r.inv_no)).toEqual([null, null, null]);
    expect((await repo.getOrder(1))!.invNo).toBe("1");

    // The first sale after the update still opens its month at 1000; legacy
    // NULL rows in the same month don't disturb the sequence.
    const fish = (await repo.getItemByKey("tilapia"))!;
    const order = await createOrder(repo, {
      method: "Cash",
      ts: 9000,
      businessDate: "2026-08-11",
      lines: [{ itemId: fish.id, qtyMilli: 1000, tailCount: 1 }],
    });
    expect(order.invNo).toBe("08-1000");
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
    const c = await repo.closeDay("2026-07-13", { companyId: 1, at: new Date(2026, 6, 13, 21).getTime() });
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

describe("stock tracking", () => {
  let repo: SqlPosRepo;
  beforeEach(async () => {
    repo = await freshRepo();
  });

  const stockedItem = () =>
    repo.createItem({ key: "cup-drink", name: "Cup Drink", unit: "cup", priceCents: 500, stockMilli: 5000 });

  it("deducts stock when a sale is made, but only for tracked items", async () => {
    const cup = await stockedItem();
    const fish = (await repo.getItemByKey("tilapia"))!; // no stock set — untracked

    await createOrder(repo, {
      method: "Cash",
      ts: 1000,
      lines: [
        { itemId: cup.id, qtyMilli: 2000 },
        { itemId: fish.id, qtyMilli: 3000, tailCount: 1 },
      ],
    });
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(3000);
    expect((await repo.getItem(fish.id))!.stockMilli).toBeNull();
  });

  it("rejects a sale that oversells the remaining stock", async () => {
    const cup = await stockedItem();
    await expect(
      createOrder(repo, { method: "Cash", ts: 1000, lines: [{ itemId: cup.id, qtyMilli: 6000 }] }),
    ).rejects.toThrow(/stock/);
    // The whole order rolled back: nothing sold, nothing deducted.
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(5000);
    expect((await repo.listOrders(0, Number.MAX_SAFE_INTEGER)).length).toBe(0);
  });

  it("restores stock when a sale is voided — once, even on a double void", async () => {
    const cup = await stockedItem();
    const order = await createOrder(repo, {
      method: "Cash",
      ts: 1000,
      lines: [{ itemId: cup.id, qtyMilli: 2000 }],
    });
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(3000);

    await repo.voidOrder(order.id, 2000);
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(5000);
    await repo.voidOrder(order.id, 3000); // double void must not restore again
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(5000);
  });

  it("updateItem can set, change and clear the stock count", async () => {
    const cup = await stockedItem();
    await repo.updateItem(cup.id, { stockMilli: 9000 });
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(9000);
    // Absent key keeps the current stock; explicit null stops tracking.
    await repo.updateItem(cup.id, { name: "Cup Drink XL" });
    expect((await repo.getItem(cup.id))!.stockMilli).toBe(9000);
    await repo.updateItem(cup.id, { stockMilli: null });
    expect((await repo.getItem(cup.id))!.stockMilli).toBeNull();
  });
});

describe("close-day future guard", () => {
  it("refuses to close a business day before it arrives on the wall clock", async () => {
    const repo = await freshRepo();
    const at = new Date(2026, 6, 13, 21).getTime(); // local 2026-07-13, 9pm
    await repo.closeDay("2026-07-13", { at }); // today: fine
    // Sales after the close carry into 2026-07-14 — but that day can't be
    // closed until the clock reaches it.
    await expect(repo.closeDay("2026-07-14", { at })).rejects.toThrow(/before that day arrives/);
    const nextDay = new Date(2026, 6, 14, 8).getTime();
    await expect(repo.closeDay("2026-07-14", { at: nextDay })).resolves.toBeTruthy();
  });
});
