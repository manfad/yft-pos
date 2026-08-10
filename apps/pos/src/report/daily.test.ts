import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Credit, Order, OrderLine } from "@yf/core";
import {
  buildDailyExcelB64,
  buildDailyWorkbook,
  CREDIT_HEADERS,
  FISH_SALES_HEADERS,
  SALES_LIST_HEADERS,
  TODAY_SALES_HEADERS,
} from "./daily";

const line = (partial: Partial<OrderLine> & Pick<OrderLine, "name" | "qtyMilli" | "amountCents">): OrderLine => ({
  id: partial.id ?? 1,
  itemId: partial.itemId ?? 1,
  name: partial.name,
  image: "",
  unit: partial.unit ?? "kg",
  tint: "#fff",
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
    method: "QR",
    totalCents: 999,
    voidedAt: Date.now(),
    items: [line({ name: "Voided fish", qtyMilli: 1000, tailCount: 1, amountCents: 999 })],
  },
];

const outstanding: Credit[] = [
  {
    id: 1,
    companyId: 1,
    orderId: 95,
    name: "Restoran Selera",
    amountCents: 24000,
    date: new Date("2026-08-07T12:00:00+08:00").getTime(),
    clearedAt: null,
  },
];

const rowsOf = (workbook: XLSX.WorkBook, name: string): unknown[][] =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name]!, { header: 1, raw: true, defval: "" });

describe("daily Excel workbook (template v2)", () => {
  it("creates the five demo-matching sheets", () => {
    const workbook = buildDailyWorkbook(orders, [], outstanding);
    expect(workbook.SheetNames).toEqual([
      "Sales List",
      "Today Sales",
      "Fish Sales",
      "Sales Detail",
      "Credit",
    ]);
  });

  it("splits each sale into Cash/Credit on the Sales List", () => {
    const workbook = buildDailyWorkbook(orders);
    const list = rowsOf(workbook, "Sales List");
    expect(list[0]).toEqual([...SALES_LIST_HEADERS]);
    expect(list[1]).toEqual(["", "2026-08-10", 101, "Cash", 69.3, ""]);
    expect(list[2]).toEqual(["Pak Abu", "2026-08-10", 102, "Credit", "", 12]);
    expect(list.flat()).not.toContain(103); // voided sale excluded
    expect(workbook.Sheets["Sales List"]!["E4"]?.f).toBe("SUM(E2:E3)");
    expect(workbook.Sheets["Sales List"]!["F4"]?.f).toBe("SUM(F2:F3)");
  });

  it("merges qty with its unit on Today Sales", () => {
    const workbook = buildDailyWorkbook(orders);
    const today = rowsOf(workbook, "Today Sales");
    expect(today[0]).toEqual([...TODAY_SALES_HEADERS]);
    expect(today[1]).toEqual(["Ikan Tilapia", 25, "2.5 kg", 62.5]);
    expect(workbook.Sheets["Today Sales"]!["D5"]?.f).toBe("SUM(D2:D4)");
    expect(today).toContainEqual(["Cash", "", 1, 69.3]);
    expect(today).toContainEqual(["Credit", "", 1, 12]);
    expect(today.flat()).toContain("Voided: 1 sale(s)");
  });

  it("lists only fish sales with the ekor count as qty", () => {
    const workbook = buildDailyWorkbook(orders);
    const fish = rowsOf(workbook, "Fish Sales");
    expect(fish[0]).toEqual([...FISH_SALES_HEADERS]);
    // order 101 has tilapia (3 ekor) — full invoice amount in Cash.
    expect(fish[1]).toEqual([101, "Cash", 69.3, "", 3]);
    // order 102 is chicken-only, order 103 is voided — neither appears.
    expect(fish).toHaveLength(3); // header + one fish sale + total
    expect(workbook.Sheets["Fish Sales"]!["E3"]?.f).toBe("SUM(E2:E2)");
  });

  it("stacks today's credit sales above the outstanding ledger", () => {
    const workbook = buildDailyWorkbook(orders, [], outstanding);
    const credit = rowsOf(workbook, "Credit");
    expect(credit[0]?.[0]).toBe("ADDED TODAY — 2026-08-10");
    expect(credit[1]).toEqual([...CREDIT_HEADERS]);
    expect(credit[2]).toEqual(["2026-08-10", 102, "Pak Abu", 12]);
    expect(credit[5]?.[0]).toBe("ALL OUTSTANDING");
    expect(credit[7]).toEqual(["2026-08-07", 95, "Restoran Selera", 240]);
    expect(credit[10]?.[0]).toBe("BY CREDITOR");
    expect(credit[12]).toEqual(["Restoran Selera", "", 1, 240]);
  });

  it("writes a valid xlsx attachment", () => {
    const workbook = XLSX.read(buildDailyExcelB64(orders), { type: "base64" });
    expect(workbook.SheetNames).toContain("Sales List");
    expect(rowsOf(workbook, "Sales Detail").flat()).toContain("Inv #102 — Pak Abu");
  });

  it("keeps an empty-sales workbook usable with zero footer totals", () => {
    const workbook = buildDailyWorkbook([]);
    const list = workbook.Sheets["Sales List"]!;
    expect(rowsOf(workbook, "Sales List")).toEqual([
      [...SALES_LIST_HEADERS],
      ["TOTAL", "", "", "", 0, 0],
    ]);
    expect(list["E2"]?.v).toBe(0);
    expect(list["E2"]?.f).toBeUndefined();
  });
});
