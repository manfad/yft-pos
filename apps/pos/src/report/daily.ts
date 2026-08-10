import * as XLSX from "xlsx";
import {
  aggregateItemSales,
  computeStats,
  fmtMoney,
  PAYMENT_METHODS,
  toQty,
  toRM,
  type Item,
  type Order,
} from "@yf/core";

// The daily HQ report artifacts: the Excel attachment and the email body.
//
// Excel layout (per the client):
//  - Sheet "Sales": one row per receipt; fixed columns first, then one column
//    per catalogue item — tail-tracking items get a kg AND an ekor column.
//    The column set is the full catalogue in a fixed order, so every day's
//    file lines up when HQ pastes days together.
//  - Sheet "Totals": per-item day totals, payment-method split, grand total.

interface ItemCol {
  key: string; // itemId or name-based key, matches aggregate keys
  header: string;
  kind: "qty" | "tail";
  itemId: number | null;
  name: string;
}

const lineKey = (itemId: number | null, name: string, unit: string): string =>
  itemId != null ? `id:${itemId}` : `name:${name}:${unit}`;

function buildColumns(catalog: Item[], orders: Order[]): ItemCol[] {
  const cols: ItemCol[] = [];
  const seen = new Set<string>();
  const push = (itemId: number | null, name: string, unit: string, tracksTail: boolean) => {
    const key = lineKey(itemId, name, unit);
    if (seen.has(key)) return;
    seen.add(key);
    cols.push({ key, header: `${name} (${unit})`, kind: "qty", itemId, name });
    if (tracksTail) cols.push({ key, header: `${name} (ekor)`, kind: "tail", itemId, name });
  };
  for (const it of catalog) push(it.id, it.name, it.unit, it.tracksTail);
  // Lines whose item was deleted from the catalogue still need somewhere to go.
  for (const o of orders) {
    for (const l of o.items) push(l.itemId, l.name, l.unit, l.tailCount > 0);
  }
  return cols;
}

/** Sheet 1 — one row per receipt, catalogue items as columns. */
function salesSheet(orders: Order[], cols: ItemCol[]): XLSX.WorkSheet {
  const header = ["Receipt", "Time", "Pay type", "Creditor", "Status", "Total (RM)", ...cols.map((c) => c.header)];
  const rows = [...orders]
    .sort((a, b) => a.ts - b.ts)
    .map((o) => {
      const perCol = new Map<ItemCol, number>();
      for (const l of o.items) {
        const key = lineKey(l.itemId, l.name, l.unit);
        for (const c of cols) {
          if (c.key !== key) continue;
          const add = c.kind === "qty" ? toQty(l.qtyMilli) : l.tailCount;
          perCol.set(c, (perCol.get(c) ?? 0) + add);
        }
      }
      return [
        o.id,
        new Date(o.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        o.method,
        o.creditorName ?? "",
        o.voidedAt != null ? "VOID" : "",
        toRM(o.totalCents),
        ...cols.map((c) => {
          const v = perCol.get(c);
          return v == null || v === 0 ? "" : v;
        }),
      ];
    });
  return XLSX.utils.aoa_to_sheet([header, ...rows]);
}

/** Sheet 2 — per-item totals + payment split + grand total (voids excluded). */
function totalsSheet(orders: Order[]): XLSX.WorkSheet {
  const sales = aggregateItemSales(orders); // skips voided internally
  const stats = computeStats(orders, "today");
  const voided = orders.filter((o) => o.voidedAt != null);

  const rows: (string | number)[][] = [["Item", "Ekor", "Qty", "Amount (RM)"]];
  for (const s of sales) {
    rows.push([s.name, s.tailCount || "", toQty(s.qtyMilli), toRM(s.amountCents)]);
  }
  rows.push([]);
  for (const m of PAYMENT_METHODS) {
    const b = stats.byMethod[m];
    rows.push([`${m} sales`, "", b.count, toRM(b.totalCents)]);
  }
  rows.push([]);
  rows.push(["Voided sales", "", voided.length, toRM(voided.reduce((a, o) => a + o.totalCents, 0))]);
  rows.push(["TOTAL", "", stats.count, toRM(stats.totalCents)]);
  return XLSX.utils.aoa_to_sheet(rows);
}

/** The daily workbook as base64 (stored on the outbox row, attached by main). */
export function buildDailyExcelB64(orders: Order[], catalog: Item[]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, salesSheet(orders, buildColumns(catalog, orders)), "Sales");
  XLSX.utils.book_append_sheet(wb, totalsSheet(orders), "Totals");
  return XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
}

export function dailyEmailSubject(storeName: string, businessDate: string, auto: boolean): string {
  return `${storeName} — Daily sales ${businessDate}${auto ? " (auto-closed)" : ""}`;
}

/** Plain-text body: the same numbers as the printed day report. */
export function dailyEmailBody(
  storeName: string,
  businessDate: string,
  orders: Order[],
  auto: boolean,
): string {
  const stats = computeStats(orders, "today");
  const sales = aggregateItemSales(orders);
  const voided = orders.filter((o) => o.voidedAt != null);

  const lines: string[] = [
    `${storeName} — daily sales for ${businessDate}`,
    auto ? "(Closed automatically — the day was not closed at the till.)" : "",
    "",
    `TOTAL: ${fmtMoney(stats.totalCents)}  (${stats.count} sales)`,
    ...PAYMENT_METHODS.map((m) => {
      const b = stats.byMethod[m];
      return b.count ? `  ${m}: ${fmtMoney(b.totalCents)} (${b.count})` : "";
    }),
    voided.length
      ? `  Voided: ${voided.length} sale(s), ${fmtMoney(voided.reduce((a, o) => a + o.totalCents, 0))} — see Excel`
      : "",
    "",
    "By item:",
    ...sales.map(
      (s) =>
        `  ${s.name}: ${toQty(s.qtyMilli)}${s.tailCount ? ` / ${s.tailCount} ekor` : ""} — ${fmtMoney(s.amountCents)}`,
    ),
    "",
    "Full breakdown attached (Excel). DB backup attached.",
  ];
  return lines.filter((l) => l !== "").join("\n");
}
