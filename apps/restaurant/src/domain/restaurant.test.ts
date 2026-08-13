import { describe, expect, it } from "vitest";
import { lineTotal, orderLabel, orderTotal } from "./restaurant";
import type { OrderLine, RestaurantOrder } from "./types";

const line = (status: "active" | "cancelled", quantity = 2): OrderLine => ({ id: "l", menuItemId: "m", name: "Fish", quantity, unitPriceCents: 1500, servingNote: "", kitchenNote: "", status });

describe("restaurant totals", () => {
  it("excludes cancelled lines", () => expect(orderTotal({ lines: [line("active"), line("cancelled")] })).toBe(3000));
  it("totals active quantities", () => expect(lineTotal(line("active", 3))).toBe(4500));
  it("uses an explicitly agreed discounted line total", () => expect(lineTotal({ ...line("active", 3), totalPriceCents: 2800 })).toBe(2800));
});

describe("order labels", () => {
  const order = { dailyNumber: 7, serviceType: "dine_in" } as RestaurantOrder;
  it("shows the permanent number and waiting state", () => expect(orderLabel(order)).toBe("#007 · Waiting for table"));
  it("shows an assigned table", () => expect(orderLabel(order, "Table 2")).toBe("#007 · Table 2"));
});
