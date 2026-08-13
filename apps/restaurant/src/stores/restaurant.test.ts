import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useRestaurantStore } from "./restaurant";

describe("table assignment", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("assigns a waiting dine-in order to a free table", () => {
    const store = useRestaurantStore();
    const table = store.tables[0]!;
    const order = store.createOrder({ lines: [], serviceType: "dine_in", tableId: null });
    expect(store.assignTable(order.id, table.id)).toBe(true);
    expect(store.tableOrder(table.id)?.id).toBe(order.id);
  });

  it("moves an order between tables", () => {
    const store = useRestaurantStore();
    const [first, second] = [store.tables[0]!, store.tables[1]!];
    const order = store.createOrder({ lines: [], serviceType: "dine_in", tableId: first.id });
    expect(store.assignTable(order.id, second.id)).toBe(true);
    expect(store.tableOrder(first.id)).toBeUndefined();
    expect(store.tableOrder(second.id)?.id).toBe(order.id);
  });

  it("keeps an order on its own table when reassigned to it", () => {
    const store = useRestaurantStore();
    const table = store.tables[0]!;
    const order = store.createOrder({ lines: [], serviceType: "dine_in", tableId: table.id });
    expect(store.assignTable(order.id, table.id)).toBe(true);
  });

  it("refuses a table already taken by another ongoing order", () => {
    const store = useRestaurantStore();
    const table = store.tables[0]!;
    const seated = store.createOrder({ lines: [], serviceType: "dine_in", tableId: table.id });
    const waiting = store.createOrder({ lines: [], serviceType: "dine_in", tableId: null });
    expect(store.assignTable(waiting.id, table.id)).toBe(false);
    expect(store.tableOrder(table.id)?.id).toBe(seated.id);
  });

  it("returns an order to waiting", () => {
    const store = useRestaurantStore();
    const table = store.tables[0]!;
    const order = store.createOrder({ lines: [], serviceType: "dine_in", tableId: table.id });
    expect(store.assignTable(order.id, null)).toBe(true);
    expect(store.tableOrder(table.id)).toBeUndefined();
  });
});
