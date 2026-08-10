import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Order, OrderLine } from "@yf/core";
import {
  buildDailyExcelB64,
  buildDailyWorkbook,
  HQ_DAILY_HEADERS,
  INVOICE_ITEM_HEADERS,
  SALES_EXPORT_HEADERS,
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
    items: [line({ name: "Ayam", unit: "each", qtyMilli: 1000, tailCount: 2, priceCents: 1200, amountCents: 1200 })],
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

const rowsOf = (workbook: XLSX.WorkBook, name: string): unknown[][] =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name]!, { header: 1, raw: true, defval: "" });

describe("daily Excel workbook", () => {
  it("creates detailed HQ, item, compact export, and totals sheets", () => {
    const workbook = buildDailyWorkbook(orders);
    expect(workbook.SheetNames).toEqual(["HQ Daily", "Invoice Items", "Sales Export", "Totals"]);

    const hq = rowsOf(workbook, "HQ Daily");
    expect(hq[0]).toEqual([...HQ_DAILY_HEADERS]);
    expect(hq[1]).toEqual(["", "2026-08-10", 101, "Cash", 69.3, "", 2.5, 3, 0, ""]);
    expect(hq[2]).toEqual(["Pak Abu", "2026-08-10", 102, "Credit", 12, 12, 0, 0, 2, ""]);
    expect(workbook.Sheets["HQ Daily"]!["E4"]?.f).toBe("SUM(E2:E3)");
    expect(workbook.Sheets["HQ Daily"]!["F4"]?.f).toBe("SUM(F2:F3)");
    expect(workbook.Sheets["HQ Daily"]!["H4"]?.f).toBe("SUM(H2:H3)");

    const detail = rowsOf(workbook, "Invoice Items");
    expect(detail[0]).toEqual([...INVOICE_ITEM_HEADERS]);
    expect(detail).toHaveLength(5); // header + 3 valid item lines + total
    expect(detail[2]?.slice(0, 8)).toEqual(["", "2026-08-10", expect.any(String), 101, "Cash", "Fresh Milk", "bottle", 1]);
    expect(detail[3]?.slice(0, 6)).toEqual(["Pak Abu", "2026-08-10", expect.any(String), 102, "Credit", "Ayam"]);

    const compact = rowsOf(workbook, "Sales Export");
    expect(compact[0]).toEqual([...SALES_EXPORT_HEADERS]);
    expect(compact[1]).toEqual(["2026-08-10", expect.any(String), 101, 69.3, 2.5, 3, 0, "Cash"]);
    expect(compact[2]).toEqual(["2026-08-10", expect.any(String), 102, 12, 0, 0, 2, "Credit"]);
    expect(compact.flat()).not.toContain(103);
  });

  it("writes a valid xlsx attachment", () => {
    const workbook = XLSX.read(buildDailyExcelB64(orders), { type: "base64" });
    expect(workbook.SheetNames).toContain("HQ Daily");
    expect(rowsOf(workbook, "Invoice Items")[1]?.[5]).toBe("Ikan Tilapia");
  });

  it("keeps an empty-sales workbook usable with zero footer totals", () => {
    const workbook = buildDailyWorkbook([]);
    const hq = workbook.Sheets["HQ Daily"]!;
    expect(rowsOf(workbook, "HQ Daily")).toEqual([
      [...HQ_DAILY_HEADERS],
      ["TOTAL", "", "", "", 0, 0, 0, 0, 0, ""],
    ]);
    expect(hq["E2"]?.v).toBe(0);
    expect(hq["E2"]?.f).toBeUndefined();
  });
});
