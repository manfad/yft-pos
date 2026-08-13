import type { MenuItem, OrderLine, RestaurantData, RestaurantOrder } from "./types";

export const uid = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const money = (cents: number): string => `RM ${(cents / 100).toFixed(2)}`;
export const lineTotal = (line: OrderLine): number => line.status === "cancelled" ? 0 : line.totalPriceCents ?? line.quantity * line.unitPriceCents;
export const orderTotal = (order: Pick<RestaurantOrder, "lines">): number => order.lines.reduce((sum, line) => sum + lineTotal(line), 0);
export const orderLabel = (order: RestaurantOrder, tableName?: string): string => {
  const number = `#${String(order.dailyNumber).padStart(3, "0")}`;
  if (order.serviceType === "takeaway") return `${number} · Takeaway`;
  return `${number} · ${tableName ?? "Waiting for table"}`;
};

const menu = (name: string, category: string, priceCents: number, sortOrder: number, options: Partial<MenuItem> = {}): MenuItem => ({
  id: uid("menu"), name, category, priceCents, sortOrder, pricingMode: "fixed", checkoutOnly: false, available: true, archived: false, ...options
});

export function createSeedData(): RestaurantData {
  return {
    version: 1,
    categories: ["Fish", "Chicken", "Vegetables", "Tofu", "Egg", "Checkout add-ons"],
    menuItems: [
      menu("Steamed Fish", "Fish", 3000, 1, { pricingMode: "variable" }),
      menu("Fried Fish", "Fish", 3000, 2, { pricingMode: "variable" }),
      menu("Fried Chicken", "Chicken", 1500, 3, { pricingMode: "variable" }),
      menu("Sweet and Sour Chicken", "Chicken", 1800, 4, { pricingMode: "variable" }),
      menu("Stir-fried Kangkung", "Vegetables", 1200, 5),
      menu("Mixed Vegetables", "Vegetables", 1400, 6),
      menu("Tofu with Minced Meat", "Tofu", 1600, 7),
      menu("Omelette", "Egg", 1000, 8),
      menu("Rice", "Checkout add-ons", 200, 20, { checkoutOnly: true }),
      menu("Packaged Drink", "Checkout add-ons", 300, 21, { checkoutOnly: true })
    ],
    tables: [
      { id: uid("table"), label: "Table 1", x: 69, y: 67 },
      { id: uid("table"), label: "Table 2", x: 65, y: 43 },
      { id: uid("table"), label: "Table 3", x: 76, y: 24 },
      { id: uid("table"), label: "Table 4", x: 67, y: 8 },
      { id: uid("table"), label: "Table 5", x: 50, y: 25 },
      { id: uid("table"), label: "Table 6", x: 45, y: 43 },
      { id: uid("table"), label: "Table 7", x: 25, y: 43 },
      { id: uid("table"), label: "Table 8", x: 30, y: 25 },
      { id: uid("table"), label: "Table 9", x: 17, y: 14 },
      { id: uid("table"), label: "Table 10", x: 37, y: 7 }
    ],
    orders: []
  };
}
