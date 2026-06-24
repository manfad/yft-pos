<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { fmtMoney, fmtQtyUnit, periodRange, type Order, type Unit } from "@yf/core";
import dayjs from "dayjs";
import TopBar from "../components/TopBar.vue";
import { getRepo } from "../db";
import { currentCompany } from "../place";
import { from, setToday } from "../salesDate";
import { PAYMENT_UI } from "../payments";

// Per-item sales for the date chosen in the top nav (shared `from`): the selected
// day, and that month up to and including the selected day (month-to-date).
const sel = computed(() => dayjs(from.value));
const monthOrders = ref<Order[]>([]);

async function loadReport(): Promise<void> {
  const repo = await getRepo();
  const [s, e] = periodRange("month", sel.value.toDate());
  monthOrders.value = await repo.listOrders(s, e, currentCompany.value.id);
}
onMounted(loadReport);
// The report's date is transient: reset to today on leave so it never carries a
// stale date back to the dashboard (avoids picking the wrong day by accident).
onUnmounted(setToday);
watch([from, () => currentCompany.value.id], loadReport);

const dayStart = computed(() => sel.value.startOf("day").valueOf());
const dayEndExcl = computed(() => sel.value.startOf("day").add(1, "day").valueOf());
const dayOrders = computed(() =>
  monthOrders.value.filter((o) => o.ts >= dayStart.value && o.ts < dayEndExcl.value),
);
// monthOrders already starts at the 1st, so this is month-start .. end of the day.
const mtdOrders = computed(() => monthOrders.value.filter((o) => o.ts < dayEndExcl.value));

interface Row {
  key: string;
  name: string;
  unit: Unit;
  qtyMilli: number;
  cash: number;
  bank: number;
  qr: number;
  total: number;
}

function aggregate(orders: Order[]): Row[] {
  const map = new Map<string, Row>();
  for (const o of orders) {
    for (const li of o.items) {
      const key = li.itemId != null ? `id:${li.itemId}` : `name:${li.name}:${li.unit}`;
      let row = map.get(key);
      if (!row) {
        row = { key, name: li.name, unit: li.unit, qtyMilli: 0, cash: 0, bank: 0, qr: 0, total: 0 };
        map.set(key, row);
      }
      row.qtyMilli += li.qtyMilli;
      if (o.method === "Cash") row.cash += li.amountCents;
      else if (o.method === "Bank") row.bank += li.amountCents;
      else if (o.method === "QR") row.qr += li.amountCents;
      row.total += li.amountCents;
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const totals = (rows: Row[]): { cash: number; bank: number; qr: number; total: number } =>
  rows.reduce(
    (a, r) => ({ cash: a.cash + r.cash, bank: a.bank + r.bank, qr: a.qr + r.qr, total: a.total + r.total }),
    { cash: 0, bank: 0, qr: 0, total: 0 },
  );

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
    <div class="text-23px font-800 flex-none">Sales Report</div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-22px items-start">
      <div
        v-for="p in panels"
        :key="p.kind"
        class="bg-surface border-2 border-border rounded-22px p-24px flex flex-col gap-16px"
      >
        <div>
          <div class="text-20px font-800">{{ p.title }}</div>
          <div class="text-15px font-700 text-muted">{{ p.sub }}</div>
        </div>

        <table class="w-full border-collapse">
          <thead>
            <tr class="text-12px font-800 text-faint uppercase tracking-wide">
              <th class="text-left font-800 pb-12px">Item</th>
              <th class="text-right font-800 pb-12px px-6px">Qty</th>
              <th class="text-right font-800 pb-12px px-6px" :style="{ color: PAYMENT_UI.Cash.color }">Cash</th>
              <th class="text-right font-800 pb-12px px-6px" :style="{ color: PAYMENT_UI.Bank.color }">Online</th>
              <th class="text-right font-800 pb-12px px-6px" :style="{ color: PAYMENT_UI.QR.color }">QR</th>
              <th class="text-right font-800 pb-12px pl-6px">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in p.rows" :key="r.key" class="border-t-2 border-borderSoft">
              <td class="py-10px pr-6px text-16px font-800 truncate">{{ r.name }}</td>
              <td class="py-10px px-6px text-right text-16px font-800 text-muted whitespace-nowrap">
                {{ fmtQtyUnit(r.qtyMilli, r.unit) }}
              </td>
              <td class="py-10px px-6px text-right font-display text-17px font-600 whitespace-nowrap" :style="{ color: PAYMENT_UI.Cash.color }">
                {{ r.cash ? fmtMoney(r.cash) : "—" }}
              </td>
              <td class="py-10px px-6px text-right font-display text-17px font-600 whitespace-nowrap" :style="{ color: PAYMENT_UI.Bank.color }">
                {{ r.bank ? fmtMoney(r.bank) : "—" }}
              </td>
              <td class="py-10px px-6px text-right font-display text-17px font-600 whitespace-nowrap" :style="{ color: PAYMENT_UI.QR.color }">
                {{ r.qr ? fmtMoney(r.qr) : "—" }}
              </td>
              <td class="py-10px pl-6px text-right font-display text-18px font-800 whitespace-nowrap text-ink">
                {{ fmtMoney(r.total) }}
              </td>
            </tr>
            <tr v-if="!p.rows.length">
              <td colspan="6" class="py-30px text-center text-16px font-700 text-faint">No sales yet.</td>
            </tr>
          </tbody>
          <tfoot v-if="p.rows.length">
            <tr class="border-t-2 border-border">
              <td class="pt-12px text-15px font-800 uppercase tracking-wide text-muted">Total</td>
              <td class="pt-12px px-6px" />
              <td class="pt-12px px-6px text-right font-display text-17px font-700 whitespace-nowrap" :style="{ color: PAYMENT_UI.Cash.color }">
                {{ fmtMoney(totals(p.rows).cash) }}
              </td>
              <td class="pt-12px px-6px text-right font-display text-17px font-700 whitespace-nowrap" :style="{ color: PAYMENT_UI.Bank.color }">
                {{ fmtMoney(totals(p.rows).bank) }}
              </td>
              <td class="pt-12px px-6px text-right font-display text-17px font-700 whitespace-nowrap" :style="{ color: PAYMENT_UI.QR.color }">
                {{ fmtMoney(totals(p.rows).qr) }}
              </td>
              <td class="pt-12px pl-6px text-right font-display text-19px font-800 whitespace-nowrap text-ink">
                {{ fmtMoney(totals(p.rows).total) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
