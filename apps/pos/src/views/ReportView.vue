<script setup lang="ts">
import { computed, onMounted } from "vue";
import { fmtMoney, fmtQtyUnit, type Order, type Unit } from "@yf/core";
import dayjs from "dayjs";
import TopBar from "../components/TopBar.vue";
import { useSales } from "../stores/sales";
import { PAYMENT_UI } from "../payments";

// Per-item sales broken down by payment method, for Today vs this Month.
const sales = useSales();
onMounted(() => void sales.load());

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
  { title: "Today", sub: dayjs().format("DD MMM YYYY"), rows: aggregate(sales.todayOrders) },
  { title: "This Month", sub: dayjs().format("MMMM YYYY"), rows: aggregate(sales.monthOrders) },
]);
</script>

<template>
  <TopBar mode="report" />

  <div class="flex-1 min-h-0 overflow-auto p-24px flex flex-col gap-18px">
    <div class="text-23px font-800 flex-none">Sales by Item</div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-22px items-start">
      <div
        v-for="p in panels"
        :key="p.title"
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
              <td class="pt-12px pl-6px text-right font-display text-19px font-800 whitespace-nowrap text-terracotta">
                {{ fmtMoney(totals(p.rows).total) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
