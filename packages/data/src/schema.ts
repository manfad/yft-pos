import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Drizzle's typed view of the database — the source of truth for queries and,
// later, drizzle-kit migrations. It mirrors @yf/core's SCHEMA_SQL (which still
// owns the actual DDL/migrations via init.ts for now). CHECK constraints and
// foreign keys live in SCHEMA_SQL; they don't affect query building, so they're
// omitted here. Booleans map 0/1 <-> true/false at the column.

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const unitTypes = sqliteTable("unit_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().default(1),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  unit: text("unit").notNull().default("each"),
  tint: text("tint").notNull().default("#eee"),
  priceCents: integer("price_cents").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const priceTiers = sqliteTable("price_tiers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  minQtyMilli: integer("min_qty_milli").notNull(),
  priceCents: integer("price_cents").notNull(),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().default(1),
  ts: integer("ts").notNull(),
  totalCents: integer("total_cents").notNull(),
  method: text("method", { enum: ["Cash", "Bank", "QR"] }).notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  itemId: integer("item_id"),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  unit: text("unit").notNull().default("each"),
  tint: text("tint").notNull().default("#eee"),
  priceCents: integer("price_cents").notNull(),
  qtyMilli: integer("qty_milli").notNull(),
  bulkPrice: integer("bulk_price", { mode: "boolean" }).notNull().default(false),
  bulkMinQtyMilli: integer("bulk_min_qty_milli"),
});
