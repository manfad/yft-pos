<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { fmtMoney, fmtQtyUnit, type Order, type Unit } from "@yf/core";
import dayjs from "dayjs";
import TopBar from "../components/TopBar.vue";
import CreditsPanel from "../components/CreditsPanel.vue";
import SettingsDialog from "../components/SettingsDialog.vue";
import { getRepo } from "../db";
import { currentCompany } from "../place";
import { from, setCurrentDay, setDay } from "../salesDate";

// Per-item sales for the date chosen in the top nav (shared `from`): the selected
// day, and that month up to and including the selected day (month-to-date).
// Grouped by *business day* (Close Day boundary), not wall-clock midnight, so
// the printed/emailed daily report and this page always agree.
const sel = computed(() => dayjs(from.value));
const mtdOrders = ref<Order[]>([]);
const settingsOpen = ref(false);

async function loadReport(): Promise<void> {
  const repo = await getRepo();
  mtdOrders.value = await repo.listOrdersByBusinessDate(
    sel.value.format("YYYY-MM-01"),
    sel.value.format("YYYY-MM-DD"),
    currentCompany.value.id,
  );
}
// The shared date is transient between pages: entering the report starts from
// the live business day, never a date left behind by the dashboard. Close Day is
// the exception — it lands here on the just-closed day via ?date=.
const route = useRoute();
onMounted(() => {
  const q = route.query.date;
  if (typeof q === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q)) setDay(q);
  else setCurrentDay();
  void loadReport();
});
watch([from, () => currentCompany.value.id], loadReport);

const dayOrders = computed(() =>
  mtdOrders.value.filter((o) => o.businessDate === sel.value.format("YYYY-MM-DD")),
);

interface Row {
  key: string;
  name: string;
  unit: Unit;
  qtyMilli: number;
  /** total head count ("ekor") sold for this item; 0 for non-ekor items */
  tailCount: number;
  total: number;
}

function aggregate(orders: Order[]): Row[] {
  const map = new Map<string, Row>();
  for (const o of orders) {
    if (o.voidedAt != null) continue; // cancelled sales don't report
    for (const li of o.items) {
      const key = li.itemId != null ? `id:${li.itemId}` : `name:${li.name}:${li.unit}`;
      let row = map.get(key);
      if (!row) {
        row = { key, name: li.name, unit: li.unit, qtyMilli: 0, tailCount: 0, total: 0 };
        map.set(key, row);
      }
      row.qtyMilli += li.qtyMilli;
      row.tailCount += li.tailCount;
      row.total += li.amountCents;
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const totals = (rows: Row[]): { total: number } =>
  rows.reduce((a, r) => ({ total: a.total + r.total }), { total: 0 });

const panels = computed(() => [
  { kind: "day" as const, title: "Day", sub: sel.value.format("DD MMM YYYY"), rows: aggregate(dayOrders.value) },
  {
    kind: "mtd" as const,
    title: "Month",
    sub: `${sel.value.startOf("month").format("DD")} - ${sel.value.format("DD MMM YYYY")}`,
    rows: aggregate(mtdOrders.value),
  },
]);
</script>

<template>
  <TopBar mode="report" />

  <div class="flex-1 min-h-0 overflow-auto p-24px flex flex-col gap-18px">
    <div class="flex items-center justify-between gap-16px flex-none">
      <div class="text-23px font-800">Sales Report</div>
      <button class="pill-btn h-46px px-20px text-16px" @click="settingsOpen = true">Settings</button>
    </div>

    <!-- Day/Month report card (~60%) on the left, outstanding-credits panel on the right. -->
    <div class="flex flex-col lg:flex-row gap-22px items-start">
    <!-- Each panel is its own query container with a fluid base font-size, and
         all the text/padding below is in `em` — so each table scales to fit the
         width it actually has. `container-type: inline-size` also applies size
         containment, which keeps a panel at its 50% grid track instead of
         growing to fit the nowrap numbers (which made the two tables overlap). -->
    <div class="w-full lg:w-3/5 bg-surface border-2 border-border rounded-22px p-24px">
      <div class="grid grid-cols-2 gap-x-24px gap-y-16px">
        <div
          v-for="p in panels"
          :key="p.kind"
          class="flex flex-col gap-[1em] min-w-0"
          style="container-type: inline-size; font-size: clamp(10px, 3.4cqi, 16px)"
        >
          <div>
            <div class="text-[1.25em] font-800">{{ p.title }}</div>
            <div class="text-[0.94em] font-700 text-muted">{{ p.sub }}</div>
          </div>

        <table class="w-full border-collapse">
          <thead>
            <tr class="text-[0.72em] font-800 text-faint uppercase tracking-wide">
              <th class="text-left font-800 pb-[0.7em]">Item</th>
              <th class="text-right font-800 pb-[0.7em] px-[0.36em] text-olive">Ekor</th>
              <th class="text-right font-800 pb-[0.7em] px-[0.36em]">Qty</th>
              <th class="text-right font-800 pb-[0.7em] pl-[0.36em]">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in p.rows" :key="r.key" class="border-t-2 border-borderSoft">
              <td class="py-[0.6em] pr-[0.36em] text-[1em] font-800 truncate">{{ r.name }}</td>
              <td class="py-[0.6em] px-[0.36em] text-right font-display text-[1.06em] font-700 whitespace-nowrap text-olive">
                {{ r.tailCount || "—" }}
              </td>
              <td class="py-[0.6em] px-[0.36em] text-right text-[1em] font-800 text-muted whitespace-nowrap">
                {{ fmtQtyUnit(r.qtyMilli, r.unit) }}
              </td>
              <td class="py-[0.6em] pl-[0.36em] text-right font-display text-[1.12em] font-800 whitespace-nowrap text-ink">
                {{ fmtMoney(r.total) }}
              </td>
            </tr>
            <tr v-if="!p.rows.length">
              <td colspan="4" class="py-[1.9em] text-center text-[1em] font-700 text-faint">No sales yet.</td>
            </tr>
          </tbody>
          <tfoot v-if="p.rows.length">
            <tr class="border-t-2 border-border">
              <td class="pt-[0.7em] text-[0.94em] font-800 uppercase tracking-wide text-muted">Total</td>
              <td class="pt-[0.7em] px-[0.36em]" />
              <td class="pt-[0.7em] px-[0.36em]" />
              <td class="pt-[0.7em] pl-[0.36em] text-right font-display text-[1.18em] font-800 whitespace-nowrap text-ink">
                {{ fmtMoney(totals(p.rows).total) }}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>

      <CreditsPanel class="w-full lg:flex-1" :company-id="currentCompany.id" />
    </div>
  </div>

  <SettingsDialog :open="settingsOpen" @close="settingsOpen = false" />
</template>
