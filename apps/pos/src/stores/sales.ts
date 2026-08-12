import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { computeStats, type Order } from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";

// Sales dashboard data, scoped to the selected company. Every period is a
// *business* day range (YYYY-MM-DD, Close Day boundary) rather than a wall-clock
// window, so a sale rung up after the day was closed counts toward the day it
// was stamped with — the same grouping /report and the HQ day report use.
//  - monthOrders: the selected month (Monthly tab + chart)
//  - rangeOrders: the selected day (Day tab) or ISO week (Weekly tab)
export const useSales = defineStore("sales", () => {
  const monthOrders = ref<Order[]>([]);
  const rangeOrders = ref<Order[]>([]);
  let month: [string, string] | null = null;
  let range: [string, string] | null = null;

  async function loadMonth(fromDate: string, toDate: string): Promise<void> {
    month = [fromDate, toDate];
    const repo = await getRepo();
    monthOrders.value = await repo.listOrdersByBusinessDate(fromDate, toDate, currentCompany.value.id);
  }

  async function loadRange(fromDate: string, toDate: string): Promise<void> {
    range = [fromDate, toDate];
    const repo = await getRepo();
    rangeOrders.value = await repo.listOrdersByBusinessDate(fromDate, toDate, currentCompany.value.id);
  }

  /** Re-run whichever periods have been loaded (after a cancel or a re-scope). */
  async function load(): Promise<void> {
    if (month) await loadMonth(...month);
    if (range) await loadRange(...range);
  }

  // Re-scope everything when the company changes.
  watch(
    () => currentCompany.value.id,
    () => void load(),
  );

  const rangeStats = computed(() => computeStats(rangeOrders.value, "all"));
  const monthStats = computed(() => computeStats(monthOrders.value, "month"));

  return {
    monthOrders,
    rangeOrders,
    rangeStats,
    monthStats,
    load,
    loadRange,
    loadMonth,
  };
});
