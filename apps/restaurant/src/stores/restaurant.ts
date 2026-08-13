import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import dayjs from "dayjs";
import { createSeedData, orderTotal, uid } from "../domain/restaurant";
import type { MenuItem, OrderDraft, OrderLine, Payment, RestaurantData, RestaurantOrder, RestaurantTable } from "../domain/types";

const STORAGE_KEY = "datuk-yap-restaurant-v0";

async function loadData(): Promise<RestaurantData | null> {
  const raw = window.restaurantStore ? await window.restaurantStore.load() : JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (!raw || typeof raw !== "object" || (raw as RestaurantData).version !== 1) return null;
  const saved = raw as RestaurantData;
  saved.categories ??= [...new Set(saved.menuItems.map((item) => item.category))];
  return saved;
}

async function saveData(data: RestaurantData): Promise<void> {
  if (window.restaurantStore) await window.restaurantStore.save(data);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const useRestaurantStore = defineStore("restaurant", () => {
  const data = ref<RestaurantData>(createSeedData());
  const ready = ref(false);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  watch(data, () => {
    if (!ready.value) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveData(data.value), 120);
  }, { deep: true });

  const menuItems = computed(() => [...data.value.menuItems].sort((a, b) => a.sortOrder - b.sortOrder));
  const categories = computed(() => data.value.categories);
  const tables = computed(() => data.value.tables);
  const orders = computed(() => data.value.orders);
  const ongoingOrders = computed(() => orders.value.filter((order) => order.status === "ongoing").sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  const doneOrders = computed(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return orders.value.filter((order) => order.status !== "ongoing" && dayjs(order.completedAt ?? order.updatedAt).format("YYYY-MM-DD") === today).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  });

  async function hydrate(): Promise<void> {
    const saved = await loadData();
    if (saved) data.value = saved;
    ready.value = true;
  }
  function tableOrder(tableId: string): RestaurantOrder | undefined { return ongoingOrders.value.find((order) => order.tableId === tableId); }
  function nextDailyNumber(): number {
    const today = dayjs().format("YYYY-MM-DD");
    return Math.max(0, ...orders.value.filter((order) => dayjs(order.createdAt).format("YYYY-MM-DD") === today).map((order) => order.dailyNumber)) + 1;
  }
  function createOrder(draft: OrderDraft): RestaurantOrder {
    const now = new Date().toISOString();
    const order: RestaurantOrder = { id: uid("order"), dailyNumber: nextDailyNumber(), ...draft, status: "ongoing", createdAt: now, updatedAt: now };
    data.value.orders.push(order);
    return order;
  }
  function updateOrder(orderId: string, lines: OrderLine[]): void {
    const order = data.value.orders.find((item) => item.id === orderId);
    if (!order || order.status !== "ongoing") return;
    order.lines = lines;
    order.updatedAt = new Date().toISOString();
  }
  function assignTable(orderId: string, tableId: string | null): boolean {
    const occupant = tableId ? tableOrder(tableId) : undefined;
    if (occupant && occupant.id !== orderId) return false;
    const order = data.value.orders.find((item) => item.id === orderId && item.status === "ongoing");
    if (!order) return false;
    order.tableId = tableId;
    order.updatedAt = new Date().toISOString();
    return true;
  }
  function cancelOrder(orderId: string): void {
    const order = data.value.orders.find((item) => item.id === orderId && item.status === "ongoing");
    if (!order) return;
    const now = new Date().toISOString();
    order.lines.forEach((line) => { if (line.status === "active") { line.status = "cancelled"; line.cancelledAt = now; } });
    order.status = "cancelled";
    order.completedAt = now;
    order.updatedAt = now;
  }
  function checkout(orderId: string, lines: OrderLine[], payment: Payment): void {
    const order = data.value.orders.find((item) => item.id === orderId && item.status === "ongoing");
    if (!order) return;
    const now = new Date().toISOString();
    order.lines = lines;
    order.payment = payment;
    order.status = "completed";
    order.completedAt = now;
    order.updatedAt = now;
  }
  function upsertMenuItem(input: Omit<MenuItem, "id" | "sortOrder"> & { id?: string }): void {
    const existing = input.id ? data.value.menuItems.find((item) => item.id === input.id) : undefined;
    if (existing) Object.assign(existing, input);
    else data.value.menuItems.push({ ...input, id: uid("menu"), sortOrder: Math.max(0, ...data.value.menuItems.map((item) => item.sortOrder)) + 1 });
  }
  function moveMenuItem(id: string, direction: -1 | 1): void {
    const list = menuItems.value;
    const from = list.findIndex((item) => item.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from]!.sortOrder, list[to]!.sortOrder] = [list[to]!.sortOrder, list[from]!.sortOrder];
  }
  function setMenuOrder(ids: string[]): void { ids.forEach((id, index) => { const item = data.value.menuItems.find((entry) => entry.id === id); if (item) item.sortOrder = index + 1; }); }
  function addCategory(name: string): boolean { const clean = name.trim(); if (!clean || data.value.categories.some((item) => item.toLowerCase() === clean.toLowerCase())) return false; data.value.categories.push(clean); return true; }
  function deleteCategory(name: string): boolean { if (data.value.menuItems.some((item) => item.category === name)) return false; data.value.categories = data.value.categories.filter((item) => item !== name); return true; }
  function addTable(): RestaurantTable {
    const next = Math.max(0, ...data.value.tables.map((entry) => Number(entry.label.match(/\d+/)?.[0] ?? 0))) + 1;
    const index = data.value.tables.length;
    const table: RestaurantTable = { id: uid("table"), label: `Table ${next}`, x: 10 + (index % 7) * 13, y: 8 + (Math.floor(index / 7) % 5) * 18 };
    data.value.tables.push(table);
    return table;
  }
  function updateTable(id: string, changes: Partial<Pick<RestaurantTable, "label" | "x" | "y">>): void {
    const table = data.value.tables.find((item) => item.id === id);
    if (table) Object.assign(table, changes);
  }
  function deleteTable(id: string): boolean {
    if (tableOrder(id)) return false;
    data.value.tables = data.value.tables.filter((item) => item.id !== id);
    return true;
  }

  const todayCompleted = computed(() => {
    const today = dayjs().format("YYYY-MM-DD");
    return orders.value.filter((order) => order.status === "completed" && order.completedAt && dayjs(order.completedAt).format("YYYY-MM-DD") === today);
  });
  const todaySalesCents = computed(() => todayCompleted.value.reduce((sum, order) => sum + orderTotal(order), 0));

  return { data, ready, menuItems, categories, tables, orders, ongoingOrders, doneOrders, todayCompleted, todaySalesCents, hydrate, tableOrder, createOrder, updateOrder, assignTable, cancelOrder, checkout, upsertMenuItem, moveMenuItem, setMenuOrder, addCategory, deleteCategory, addTable, updateTable, deleteTable };
});
