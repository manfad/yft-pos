import {
  SCHEMA_SQL,
  SEED_ITEMS,
  SEED_COMPANIES,
  SEED_UNIT_TYPES,
  generateDemoOrders,
} from "@yf/core";
import type { SqlDriver } from "./driver.js";
import { SqlPosRepo } from "./sql-repo.js";

/** Add `column` to `table` if it isn't already present (idempotent migration). */
async function ensureColumn(
  db: SqlDriver,
  table: string,
  column: string,
  ddl: string,
): Promise<void> {
  const cols = await db.all(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => String(c.name) === column)) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

async function migratePaymentMethodNames(db: SqlDriver): Promise<void> {
  const rows = await db.all(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'",
  );
  const sql = String(rows[0]?.sql ?? "");
  if (!sql.includes("Online Bank")) return;

  await db.run("PRAGMA foreign_keys = OFF");
  await db.tx(async () => {
    await db.run(`
      CREATE TABLE orders_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id  INTEGER NOT NULL DEFAULT 1,
        ts          INTEGER NOT NULL,
        total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
        method      TEXT    NOT NULL CHECK (method IN ('Cash','Bank','QR'))
      )
    `);
    await db.run(`
      INSERT INTO orders_new (id, company_id, ts, total_cents, method)
      SELECT id, company_id, ts, total_cents,
        CASE method WHEN 'Online Bank' THEN 'Bank' ELSE method END
      FROM orders
    `);
    await db.run("DROP TABLE orders");
    await db.run("ALTER TABLE orders_new RENAME TO orders");
    await db.run("CREATE INDEX IF NOT EXISTS idx_orders_ts ON orders(ts)");
    await db.run("CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id)");
  });
  await db.run("PRAGMA foreign_keys = ON");
}

/**
 * Repair historical order lines saved before bulk-pricing was snapshotted.
 * Those rows kept their discounted `price_cents` but lost `bulk_price` /
 * `bulk_min_qty_milli` (defaulted to 0/NULL), so reprinted receipts dropped the
 * "(10kg)" tier annotation. Re-derive the applied tier from the item's current
 * tiers: a line was bulk-priced when its stored unit price matches a tier whose
 * threshold its quantity met. Idempotent — only touches not-yet-annotated rows.
 */
async function backfillBulkPricing(db: SqlDriver): Promise<void> {
  const tierMatch = `
    SELECT t.min_qty_milli FROM price_tiers t
    WHERE t.item_id = order_items.item_id
      AND order_items.qty_milli >= t.min_qty_milli
      AND order_items.price_cents = t.price_cents
    ORDER BY t.min_qty_milli DESC
    LIMIT 1`;
  await db.run(
    `UPDATE order_items
     SET bulk_price = 1,
         bulk_min_qty_milli = (${tierMatch})
     WHERE bulk_min_qty_milli IS NULL
       AND item_id IS NOT NULL
       AND (${tierMatch}) IS NOT NULL`,
  );
}

export interface InitOptions {
  /** Seed plausible historical orders for the Sales report (dev/demo). */
  seedDemoOrders?: boolean;
  /** Deterministic RNG for demo orders (tests). */
  rng?: () => number;
  /** Injectable clock for demo orders (tests). */
  now?: Date;
}

/**
 * Create tables, seed the catalogue (idempotent on `key`), and optionally seed
 * demo orders. Returns a ready-to-use repo.
 */
export async function initRepo(db: SqlDriver, opts: InitOptions = {}): Promise<SqlPosRepo> {
  // Driver-agnostic: run each schema statement individually.
  for (const stmt of SCHEMA_SQL.split(";")) {
    const sql = stmt.trim();
    if (sql) await db.run(sql);
  }

  // Lightweight migration: CREATE TABLE IF NOT EXISTS won't add new columns to a
  // pre-existing DB, so backfill new columns on older local databases.
  await ensureColumn(db, "items", "company_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "orders", "company_id", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "order_items", "bulk_price", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "order_items", "bulk_min_qty_milli", "INTEGER");
  await migratePaymentMethodNames(db);
  await backfillBulkPricing(db);

  const repo = new SqlPosRepo(db);

  // Seed the lookup tables (idempotent).
  for (const name of SEED_COMPANIES) {
    await db.run("INSERT OR IGNORE INTO companies (name) VALUES (?)", [name]);
  }
  for (const name of SEED_UNIT_TYPES) {
    await db.run("INSERT OR IGNORE INTO unit_types (name) VALUES (?)", [name]);
  }

  const existing = await db.all("SELECT COUNT(*) AS n FROM items");
  if (Number(existing[0]?.n ?? 0) === 0) {
    await db.tx(async () => {
      for (const s of SEED_ITEMS) {
        const item = await repo.createItem({
          key: s.key,
          name: s.name,
          image: s.image,
          unit: s.unit,
          tint: s.tint,
          priceCents: s.priceCents,
        });
        if (s.tiers?.length) await repo.setTiers(item.id, s.tiers);
      }
    });
  }

  if (opts.seedDemoOrders) {
    const haveOrders = await db.all("SELECT COUNT(*) AS n FROM orders");
    if (Number(haveOrders[0]?.n ?? 0) === 0) {
      const items = await repo.listItems(true);
      const drafts = generateDemoOrders(items, opts.now ?? new Date(), opts.rng ?? Math.random);
      for (const d of drafts) await repo.persistOrder(d);
    }
  }

  return repo;
}
