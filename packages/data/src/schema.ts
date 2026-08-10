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
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  image: text("image").notNull().default(""),
  unit: text("unit").notNull().default("each"),
  priceCents: integer("price_cents").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  tracksTail: integer("tracks_tail", { mode: "boolean" }).notNull().default(false),
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
  businessDate: text("business_date"),
  totalCents: integer("total_cents").notNull(),
  method: text("method", { enum: ["Cash", "Bank", "QR", "Credit"] }).notNull(),
  voidedAt: integer("voided_at"),
});

export const dayCloses = sqliteTable("day_closes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().default(1),
  businessDate: text("business_date").notNull(),
  closedAt: integer("closed_at").notNull(),
  auto: integer("auto", { mode: "boolean" }).notNull().default(false),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const outbox = sqliteTable("outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().default(1),
  businessDate: text("business_date").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  attachmentName: text("attachment_name"),
  attachmentB64: text("attachment_b64"),
  createdAt: integer("created_at").notNull(),
  sentAt: integer("sent_at"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
});

export const credits = sqliteTable("credits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().default(1),
  orderId: integer("order_id").notNull(),
  name: text("name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: integer("date").notNull(),
  isClear: integer("is_clear"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  itemId: integer("item_id").notNull(),
  priceCents: integer("price_cents").notNull(),
  qtyMilli: integer("qty_milli").notNull(),
  tailCount: integer("tail_count").notNull().default(0),
});
