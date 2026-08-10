import type { Unit } from "./types.js";

// One source of truth for the DB shape + initial catalogue, shared by every
// PosRepo implementation. Mirrors the original backend, plus `price_tiers`.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS unit_types (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS items (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  key    TEXT    NOT NULL UNIQUE,
  name   TEXT    NOT NULL,
  image  TEXT    NOT NULL DEFAULT '',
  unit   TEXT    NOT NULL DEFAULT 'each',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  tracks_tail INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS price_tiers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  min_qty_milli INTEGER NOT NULL CHECK (min_qty_milli > 0),
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL DEFAULT 1,
  ts            INTEGER NOT NULL,
  business_date TEXT,
  total_cents   INTEGER NOT NULL CHECK (total_cents >= 0),
  method        TEXT    NOT NULL CHECK (method IN ('Cash','Bank','QR','Credit')),
  voided_at     INTEGER
);

CREATE TABLE IF NOT EXISTS day_closes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER NOT NULL DEFAULT 1,
  business_date TEXT    NOT NULL,
  closed_at     INTEGER NOT NULL,
  auto          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (company_id, business_date)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id      INTEGER NOT NULL DEFAULT 1,
  business_date   TEXT    NOT NULL,
  subject         TEXT    NOT NULL,
  body            TEXT    NOT NULL,
  attachment_name TEXT,
  attachment_b64  TEXT,
  created_at      INTEGER NOT NULL,
  sent_at         INTEGER,
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT
);

CREATE TABLE IF NOT EXISTS credits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   INTEGER NOT NULL DEFAULT 1,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  date         INTEGER NOT NULL,
  is_clear     INTEGER
);

CREATE TABLE IF NOT EXISTS order_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id  INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id   INTEGER NOT NULL REFERENCES items(id),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  qty_milli   INTEGER NOT NULL CHECK (qty_milli > 0),
  tail_count  INTEGER NOT NULL DEFAULT 0 CHECK (tail_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_ts       ON orders(ts);
CREATE INDEX IF NOT EXISTS idx_outbox_unsent    ON outbox(sent_at);
CREATE INDEX IF NOT EXISTS idx_orders_company   ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_order_items_oid ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_iid ON price_tiers(item_id);
CREATE INDEX IF NOT EXISTS idx_credits_company ON credits(company_id);
CREATE INDEX IF NOT EXISTS idx_credits_open ON credits(company_id, is_clear);
`;

// Companies/tenants seeded into the companies lookup (ids 1, 2, 3 in order).
export const SEED_COMPANIES = ["Yun Fook Trading", "Yun Fook Plantation", "Yun Fook Resources"];

// Units of sale seeded into the unit_types lookup.
export const SEED_UNIT_TYPES: Unit[] = ["kg", "cup", "box", "pack", "pieces", "bottle", "each"];

export interface SeedItem {
  key: string;
  name: string;
  unit: Unit;
  priceCents: number;
  image: string;
  /** sold by the head — capture a tail/"ekor" count alongside weight */
  tracksTail?: boolean;
  /** optional quantity breaks */
  tiers?: Array<{ minQtyMilli: number; priceCents: number }>;
}

// Client catalogue (Yun Fook Trading). Items without a matching photo fall back
// to their emoji + name on the tile. Prices/units marked TODO need confirming.
export const SEED_ITEMS: SeedItem[] = [
  // Ikan Tilapia: RM25/kg, wholesale break >= 10 kg -> RM23/kg.
  { key: "tilapia", name: "Ikan Tilapia", unit: "kg", priceCents: 2500, image: "/images/talapia", tracksTail: true, tiers: [{ minQtyMilli: 10000, priceCents: 2300 }] },
  { key: "ayam", name: "Ayam", unit: "kg", priceCents: 3000, image: "", tracksTail: true },
  { key: "fresh_milk_500", name: "Fresh Milk 500 ml", unit: "bottle", priceCents: 0, image: "/images/milk" }, // TODO price
  { key: "fresh_milk_1l", name: "Fresh Milk 1 L", unit: "bottle", priceCents: 680, image: "/images/milk" },
  { key: "uht_200ml", name: "UHT 200 ml", unit: "pack", priceCents: 200, image: "" },
  { key: "nangka_box", name: "Nangka (Box)", unit: "box", priceCents: 600, image: "/images/nangka" },
  { key: "nangka_kg", name: "Nangka (kg)", unit: "kg", priceCents: 400, image: "/images/nangka" },
  { key: "avocado", name: "Avocado", unit: "kg", priceCents: 0, image: "/images/avocado" }, // TODO price
  { key: "sayur", name: "Sayur", unit: "kg", priceCents: 0, image: "" }, // TODO price
  { key: "durian_paste", name: "Durian Paste", unit: "kg", priceCents: 4000, image: "/images/durian" },
];
