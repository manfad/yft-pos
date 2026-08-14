import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Credit, Item, Order, OrderLine } from "@yf/core";
import {
  buildDailyExcelB64,
  buildDailyWorkbook,
  CREDIT_HEADERS,
  EKOR_SHEET_HEADERS,
  SALES_LIST_HEADERS,
  sheetNameFor,
  TODAY_SALES_HEADERS,
} from "./daily";

const line = (partial: Partial<OrderLine> & Pick<OrderLine, "name" | "qtyMilli" | "amountCents">): OrderLine => ({
  id: partial.id ?? 1,
  itemId: partial.itemId ?? 1,
  name: partial.name,
  image: "",
  unit: partial.unit ?? "kg",
  priceCents: partial.priceCents ?? partial.amountCents,
  qtyMilli: partial.qtyMilli,
  amountCents: partial.amountCents,
  tailCount: partial.tailCount ?? 0,
  bulkPrice: false,
});

const orders: Order[] = [
  {
    id: 101,
    companyId: 1,
    ts: new Date("2026-08-10T09:15:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1005",
    method: "Cash",
    totalCents: 6930,
    voidedAt: null,
    items: [
      line({ name: "Ikan Tilapia", qtyMilli: 2500, tailCount: 3, priceCents: 2500, amountCents: 6250 }),
      line({ id: 2, itemId: 2, name: "Fresh Milk", unit: "bottle", qtyMilli: 1000, priceCents: 680, amountCents: 680 }),
    ],
  },
  {
    id: 102,
    companyId: 1,
    ts: new Date("2026-08-10T10:30:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1006",
    method: "Credit",
    creditorName: "Pak Abu",
    totalCents: 1200,
    voidedAt: null,
    items: [line({ id: 3, itemId: 3, name: "Ayam", unit: "each", qtyMilli: 1000, tailCount: 2, priceCents: 1200, amountCents: 1200 })],
  },
  {
    id: 103,
    companyId: 1,
    ts: new Date("2026-08-10T11:00:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1007",
    method: "QR",
    totalCents: 999,
    voidedAt: Date.now(),
    items: [line({ name: "Voided fish", qtyMilli: 1000, tailCount: 1, amountCents: 999 })],
  },
];

const item = (partial: Partial<Item> & Pick<Item, "id" | "name">): Item => ({
  id: partial.id,
  key: partial.key ?? `item-${partial.id}`,
  name: partial.name,
  image: "",
  unit: partial.unit ?? "kg",
  priceCents: partial.priceCents ?? 1000,
  active: partial.active ?? true,
  tracksTail: partial.tracksTail ?? false,
  stockMilli: partial.stockMilli ?? null,
  sortOrder: partial.sortOrder ?? partial.id,
});

// "Ikan Ayam-Ayam" is a real fish (triggerfish) — the v2 name regex read it as
// chicken, which is exactly the misclassification itemId matching removes.
const catalog: Item[] = [
  item({ id: 1, name: "Ikan Tilapia", tracksTail: true, sortOrder: 1 }),
  item({ id: 2, name: "Fresh Milk", unit: "bottle", sortOrder: 2 }),
  item({ id: 3, name: "Ayam", unit: "each", tracksTail: true, sortOrder: 3 }),
  item({ id: 4, name: "Ikan Ayam-Ayam", tracksTail: true, sortOrder: 4 }),
  item({ id: 5, name: "Udang Galah", tracksTail: true, sortOrder: 5 }),
  item({ id: 6, name: "Ikan Keli", tracksTail: true, active: false, sortOrder: 6 }),
];

const outstanding: Credit[] = [
  {
    id: 1,
    companyId: 1,
    orderId: 95,
    invNo: "08-1000",
    name: "Restoran Selera",
    amountCents: 24000,
    date: new Date("2026-08-07T12:00:00+08:00").getTime(),
    clearedAt: null,
  },
];

// Ekor sheets are scoped by itemId, so these exercise multi-line orders and a
// line whose snapshot name has drifted from the item it was sold as.
const ekorOrders: Order[] = [
  {
    id: 201,
    companyId: 1,
    ts: new Date("2026-08-10T09:00:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1020",
    method: "Cash",
    totalCents: 8800,
    voidedAt: null,
    items: [
      line({ name: "Ikan Tilapia", qtyMilli: 2000, tailCount: 2, amountCents: 4000 }),
      line({ name: "Ikan Tilapia", qtyMilli: 3000, tailCount: 3, amountCents: 3000 }),
      line({ id: 4, itemId: 4, name: "Ikan Ayam-Ayam", qtyMilli: 1500, tailCount: 4, amountCents: 1800 }),
    ],
  },
  {
    id: 202,
    companyId: 1,
    ts: new Date("2026-08-10T10:00:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1021",
    method: "Credit",
    creditorName: "Pak Abu",
    totalCents: 3000,
    voidedAt: null,
    items: [line({ name: "Tilapia (renamed since)", qtyMilli: 1000, tailCount: 1, amountCents: 3000 })],
  },
  {
    id: 203,
    companyId: 1,
    ts: new Date("2026-08-10T11:00:00+08:00").getTime(),
    businessDate: "2026-08-10",
    invNo: "08-1022",
    method: "Cash",
    totalCents: 9900,
    voidedAt: Date.now(),
    items: [line({ name: "Ikan Tilapia", qtyMilli: 4000, tailCount: 9, amountCents: 9900 })],
  },
];

const rowsOf = (workbook: XLSX.WorkBook, name: string): unknown[][] =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name]!, { header: 1, raw: true, defval: "" });

describe("daily Excel workbook (template v4)", () => {
  it("puts a sheet per active ekor item between Today Sales and Sales Detail", () => {
    const workbook = buildDailyWorkbook(orders, catalog, outstanding);
    expect(workbook.SheetNames).toEqual([
      "Sales List",
      "Today Sales",
      "Ikan Tilapia",
      "Ayam",
      "Ikan Ayam-Ayam",
      "Udang Galah",
      "Sales Detail",
      "Credit",
    ]);
  });

  it("scopes each ekor sheet to its item by id, summing every matching line", () => {
    const workbook = buildDailyWorkbook(ekorOrders, catalog);
    const tilapia = rowsOf(workbook, "Ikan Tilapia");
    expect(tilapia[0]).toEqual([...EKOR_SHEET_HEADERS]);
    // 201 carries two tilapia lines (2 + 3 ekor); 202's line was renamed after
    // the sale but still counts; the voided 203 is left out entirely.
    expect(tilapia[1]).toEqual([1, "08-1020", "Cash", 88, "", 5]);
    expect(tilapia[2]).toEqual([2, "08-1021", "Credit", "", 30, 1]);
    expect(tilapia).toHaveLength(4); // header + two sales + total
    expect(workbook.Sheets["Ikan Tilapia"]!["F4"]?.f).toBe("SUM(F2:F3)");
  });

  it("keeps a fish named like chicken on its own sheet, off the others", () => {
    const workbook = buildDailyWorkbook(ekorOrders, catalog);
    expect(rowsOf(workbook, "Ikan Ayam-Ayam")[1]).toEqual([1, "08-1020", "Cash", 88, "", 4]);
    // The v2 regex counted "Ikan Ayam-Ayam" as chicken; nothing leaks into Ayam.
    expect(rowsOf(workbook, "Ayam")).toHaveLength(2);
  });

  it("emits an empty ekor sheet for an item that sold nothing today", () => {
    const workbook = buildDailyWorkbook(ekorOrders, catalog);
    expect(rowsOf(workbook, "Udang Galah")).toEqual([
      [...EKOR_SHEET_HEADERS],
      ["TOTAL", "", "", 0, 0, 0],
    ]);
    const sheet = workbook.Sheets["Udang Galah"]!;
    expect(sheet["F2"]?.v).toBe(0);
    expect(sheet["F2"]?.f).toBeUndefined();
  });

  it("splits each sale into Cash/Credit on the Sales List", () => {
    const workbook = buildDailyWorkbook(orders);
    const list = rowsOf(workbook, "Sales List");
    expect(list[0]).toEqual([...SALES_LIST_HEADERS]);
    expect(list[1]).toEqual([1, "", "2026-08-10", "08-1005", "Cash", 69.3, ""]);
    expect(list[2]).toEqual([2, "Pak Abu", "2026-08-10", "08-1006", "Credit", "", 12]);
    expect(workbook.Sheets["Sales List"]!["F4"]?.f).toBe("SUM(F2:F3)");
    expect(workbook.Sheets["Sales List"]!["G4"]?.f).toBe("SUM(G2:G3)");
    // Voided sales are listed below the total under a CANCELLED title, uncounted.
    expect(list[5]?.[0]).toBe("CANCELLED");
    expect(list[6]).toEqual(["", "VOIDED", "2026-08-10", "08-1007", "QR", 9.99, ""]);
  });

  it("merges qty with its unit on Today Sales", () => {
    const workbook = buildDailyWorkbook(orders);
    const today = rowsOf(workbook, "Today Sales");
    expect(today[0]).toEqual([...TODAY_SALES_HEADERS]);
    expect(today[1]).toEqual(["Ikan Tilapia", 25, "2.5 kg", 62.5]);
    expect(today).toContainEqual(["Cash", "", 1, 69.3]);
    expect(today).toContainEqual(["Credit", "", 1, 12]);
    expect(today.flat()).toContain("Voided: 1 sale(s)");
  });

  it("splits credit items into their own block on Today Sales", () => {
    const workbook = buildDailyWorkbook(orders);
    const today = rowsOf(workbook, "Today Sales");
    // Paid items first, then the credit block — Ayam was bought on credit.
    expect(today[1]?.[0]).toBe("Ikan Tilapia");
    expect(today[2]?.[0]).toBe("Fresh Milk");
    expect(today[4]?.[0]).toBe("BY ITEM - CREDIT");
    expect(today[5]).toEqual(["Ayam", 12, "1 pc", 12]);
    expect(today[6]?.[0]).toBe("TOTAL");
    // TOTAL spans both blocks, skipping the heading rows in between.
    expect(workbook.Sheets["Today Sales"]!["D7"]?.f).toBe("SUM(D2:D3)+SUM(D6:D6)");
  });

  it("keeps Today Sales in one block when nothing was sold on credit", () => {
    const cashOnly = orders.filter((order) => order.method !== "Credit");
    const workbook = buildDailyWorkbook(cashOnly);
    const today = rowsOf(workbook, "Today Sales");
    expect(today.flat()).not.toContain("BY ITEM - CREDIT");
    expect(today[3]?.[0]).toBe("TOTAL");
    expect(workbook.Sheets["Today Sales"]!["D4"]?.f).toBe("SUM(D2:D3)");
  });

  it("carries the whole invoice amount onto each ekor sheet it appears on", () => {
    const workbook = buildDailyWorkbook(orders, catalog);
    // invoice 08-1005 has tilapia (3 ekor) — full invoice amount in Cash.
    expect(rowsOf(workbook, "Ikan Tilapia")[1]).toEqual([1, "08-1005", "Cash", 69.3, "", 3]);
    expect(rowsOf(workbook, "Ayam")[1]).toEqual([1, "08-1006", "Credit", "", 12, 2]);
    expect(workbook.Sheets["Ikan Tilapia"]!["F3"]?.f).toBe("SUM(F2:F2)");
  });

  it("stacks today's credit sales above the outstanding ledger", () => {
    const workbook = buildDailyWorkbook(orders, [], outstanding);
    const credit = rowsOf(workbook, "Credit");
    expect(credit[0]?.[0]).toBe("ADDED TODAY — 2026-08-10");
    expect(credit[1]).toEqual([...CREDIT_HEADERS]);
    expect(credit[2]).toEqual(["2026-08-10", "08-1006", "Pak Abu", 12]);
    expect(credit[5]?.[0]).toBe("ALL OUTSTANDING");
    expect(credit[7]).toEqual(["2026-08-07", "08-1000", "Restoran Selera", 240]);
    expect(credit[10]?.[0]).toBe("BY CREDITOR");
    expect(credit[12]).toEqual(["Restoran Selera", "", 1, 240]);
  });

  it("writes a valid xlsx attachment", () => {
    const workbook = XLSX.read(buildDailyExcelB64(orders), { type: "base64" });
    expect(workbook.SheetNames).toContain("Sales List");
    expect(rowsOf(workbook, "Sales Detail").flat()).toContain("Inv #08-1006 — Pak Abu");
  });

  it("keeps an empty-sales workbook usable with zero footer totals", () => {
    const workbook = buildDailyWorkbook([]);
    const list = workbook.Sheets["Sales List"]!;
    expect(rowsOf(workbook, "Sales List")).toEqual([
      [...SALES_LIST_HEADERS],
      ["TOTAL", "", "", "", "", 0, 0],
    ]);
    expect(list["F2"]?.v).toBe(0);
    expect(list["F2"]?.f).toBeUndefined();
  });
});

describe("sheetNameFor", () => {
  it("drops the characters Excel forbids and trims to 31", () => {
    expect(sheetNameFor("Ikan Merah / Kerapu?", new Set())).toBe("Ikan Merah  Kerapu");
    expect(sheetNameFor("[Siakap]: 1kg*", new Set())).toBe("Siakap 1kg");
    expect(sheetNameFor(`Ikan ${"A".repeat(40)}`, new Set())).toHaveLength(31);
  });

  it("falls back to a placeholder when nothing legal is left", () => {
    expect(sheetNameFor("///", new Set())).toBe("Item");
  });

  it("numbers collisions, including with the fixed sheets", () => {
    const taken = new Set(["Credit"]);
    expect(sheetNameFor("Ikan Merah", taken)).toBe("Ikan Merah");
    expect(sheetNameFor("Ikan Merah", taken)).toBe("Ikan Merah 2");
    expect(sheetNameFor("Ikan Merah", taken)).toBe("Ikan Merah 3");
    expect(sheetNameFor("Credit", taken)).toBe("Credit 2");
  });

  it("keeps a de-duplicated long name inside the 31-char limit", () => {
    const taken = new Set<string>();
    const long = "B".repeat(40);
    expect(sheetNameFor(long, taken)).toHaveLength(31);
    const second = sheetNameFor(long, taken);
    expect(second).toHaveLength(31);
    expect(second.endsWith(" 2")).toBe(true);
  });
});
