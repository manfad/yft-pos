import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { computeStats, periodRange, type Order } from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";

// Sales report data, scoped to the selected company:
//  - monthOrders: the current month (Monthly tab + chart)
//  - rangeOrders: an arbitrary date / date-range chosen in the "By Date" tab
export const useSales = defineStore("sales", () => {
  const monthOrders = ref<Order[]>([]);
  const rangeOrders = ref<Order[]>([]);
  let loadedOnce = false;
  let range: [number, number] | null = null;

  async function loadMonth(refDate?: Date): Promise<void> {
    const repo = await getRepo();
    const [s, e] = periodRange("month", refDate ?? new Date());
    monthOrders.value = await repo.listOrders(s, e, currentCompany.value.id);
  }

  async function loadRange(startMs: number, endMs: number): Promise<void> {
    range = [startMs, endMs];
    const repo = await getRepo();
    rangeOrders.value = await repo.listOrders(startMs, endMs, currentCompany.value.id);
  }

  async function load(): Promise<void> {
    loadedOnce = true;
    await loadMonth();
    const [s, e] = range ?? periodRange("today");
    await loadRange(s, e);
  }

  // Re-scope everything when the company changes.
  watch(
    () => currentCompany.value.id,
    () => {
      if (loadedOnce) void load();
    },
  );

  const todayOrders = computed(() => {
    const [s, e] = periodRange("today");
    return monthOrders.value.filter((o) => o.ts >= s && o.ts < e);
  });

  const rangeStats = computed(() => computeStats(rangeOrders.value, "all"));
  const todayStats = computed(() => computeStats(todayOrders.value, "today"));
  const monthStats = computed(() => computeStats(monthOrders.value, "month"));

  return {
    monthOrders,
    rangeOrders,
    todayOrders,
    rangeStats,
    todayStats,
    monthStats,
    load,
    loadRange,
    loadMonth,
  };
});
