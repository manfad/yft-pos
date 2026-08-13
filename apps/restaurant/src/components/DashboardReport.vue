<script setup lang="ts">
import { computed, shallowRef } from "vue";
import dayjs from "dayjs";
import { money, orderLabel, orderTotal } from "../domain/restaurant";
import type { PaymentMethod, RestaurantOrder } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";
import { useRestaurantUiStore } from "../stores/ui";

const store = useRestaurantStore();
const ui = useRestaurantUiStore();
const expandedId = shallowRef<string | null>(null);
const history = computed(() => store.orders.filter((order) => dayjs(order.completedAt ?? order.updatedAt).format("YYYY-MM-DD") === ui.reportDate).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)));
const paid = computed(() => history.value.filter((order) => order.status === "completed"));
const sales = computed(() => paid.value.reduce((sum, order) => sum + orderTotal(order), 0));
const average = computed(() => paid.value.length ? Math.round(sales.value / paid.value.length) : 0);
const paymentTotal = (method: PaymentMethod): number => paid.value.filter((order) => order.payment?.method === method).reduce((sum, order) => sum + orderTotal(order), 0);
const serviceTotal = (type: "dine_in" | "takeaway"): number => paid.value.filter((order) => order.serviceType === type).reduce((sum, order) => sum + orderTotal(order), 0);
function tableName(order: RestaurantOrder): string | undefined { return store.tables.find((table) => table.id === order.tableId)?.label; }
</script>

<template>
  <section class="h-full overflow-auto p-24px">
    <div class="flex items-center gap-16px mb-20px"><div><h2 class="m-0 font-display text-30px">Sales overview</h2><p class="m-0 mt-3px text-15px font-700 text-muted">Local sales and order history for the selected date.</p></div></div>
    <div class="grid grid-cols-3 gap-16px">
      <article class="yf-card p-20px"><span class="text-14px font-900 text-muted uppercase">Total sales</span><strong class="block mt-8px font-display text-40px text-terracottaDark">{{ money(sales) }}</strong></article>
      <article class="yf-card p-20px"><span class="text-14px font-900 text-muted uppercase">Paid orders</span><strong class="block mt-8px font-display text-40px">{{ paid.length }}</strong></article>
      <article class="yf-card p-20px"><span class="text-14px font-900 text-muted uppercase">Average order</span><strong class="block mt-8px font-display text-40px">{{ money(average) }}</strong></article>
    </div>
    <div class="grid grid-cols-2 gap-16px mt-16px">
      <article class="yf-card p-20px"><h3 class="m-0 mb-14px text-19px">Payment breakdown</h3><div v-for="method in (['cash','qr','bank'] as PaymentMethod[])" :key="method" class="flex justify-between py-9px border-b border-borderSoft capitalize font-800"><span>{{ method }}</span><strong>{{ money(paymentTotal(method)) }}</strong></div></article>
      <article class="yf-card p-20px"><h3 class="m-0 mb-14px text-19px">Service breakdown</h3><div class="flex justify-between py-9px border-b border-borderSoft font-800"><span>Dine in</span><strong>{{ money(serviceTotal('dine_in')) }}</strong></div><div class="flex justify-between py-9px font-800"><span>Takeaway</span><strong>{{ money(serviceTotal('takeaway')) }}</strong></div></article>
    </div>
    <div class="mt-18px yf-card overflow-hidden">
      <div class="px-20px py-16px bg-panel border-b-2 border-border flex items-center"><h3 class="m-0 text-20px">Order history</h3><span class="ml-auto text-14px font-800 text-muted">Cancelled orders are excluded from sales</span></div>
      <p v-if="!history.length" class="m-0 p-36px text-center text-17px font-800 text-muted">No completed or cancelled orders on this date.</p>
      <article v-for="order in history" :key="order.id" class="border-b border-borderSoft">
        <button class="w-full grid grid-cols-[1fr_150px_160px_140px] items-center gap-14px min-h-68px px-20px bg-transparent border-0 text-left cursor-pointer" @click="expandedId = expandedId === order.id ? null : order.id">
          <strong class="text-17px" :class="order.status === 'cancelled' ? 'line-through text-danger' : ''">{{ orderLabel(order, tableName(order)) }}</strong><span class="font-800 text-muted">{{ dayjs(order.completedAt ?? order.updatedAt).format('h:mm A') }}</span><span class="font-900 capitalize" :class="order.status === 'cancelled' ? 'text-danger' : 'text-oliveDark'">{{ order.status }}</span><strong class="text-right">{{ money(orderTotal(order)) }}</strong>
        </button>
        <div v-if="expandedId === order.id" class="px-20px pb-16px bg-panel"><div v-for="line in order.lines" :key="line.id" class="flex gap-12px py-7px text-15px font-700"><span>{{ line.quantity }}×</span><span class="flex-1" :class="line.status === 'cancelled' ? 'line-through text-danger' : ''">{{ line.name }}</span><span :class="line.status === 'cancelled' ? 'line-through text-danger' : ''">{{ money(line.status === 'cancelled' ? 0 : line.quantity * line.unitPriceCents) }}</span></div><div class="pt-8px mt-6px border-t border-border text-13px font-800 text-muted">{{ order.payment ? `${order.payment.method.toUpperCase()} payment` : 'Cancelled without payment' }}</div></div>
      </article>
    </div>
  </section>
</template>
