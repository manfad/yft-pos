<script setup lang="ts">
import { YfDialog } from "@yf/ui";
import { money, orderLabel, orderTotal } from "../domain/restaurant";
import type { RestaurantOrder } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";

const props = defineProps<{ open: boolean; order: RestaurantOrder | null }>();
defineEmits<{ edit: []; checkout: []; assign: []; cancel: []; close: [] }>();
const store = useRestaurantStore();
function label(): string { const table = store.tables.find((entry) => entry.id === props.order?.tableId); return props.order ? orderLabel(props.order, table?.label) : "Order"; }
</script>

<template>
  <YfDialog :open="open" :title="label()" width="650px" @close="$emit('close')">
    <div v-if="order" class="p-24px">
      <div class="flex items-center gap-10px mb-16px"><span class="yf-chip bg-warm text-terracottaDark">{{ order.serviceType === 'dine_in' ? 'Dine in' : 'Takeaway' }}</span><span v-if="order.serviceType === 'dine_in' && !order.tableId" class="yf-chip bg-occupied text-ink">Waiting for table</span></div>
      <div class="flex flex-col gap-10px">
        <div v-for="line in order.lines" :key="line.id" class="flex items-start gap-12px p-14px bg-panel rounded-14px">
          <span class="text-16px font-900">{{ line.quantity }}×</span>
          <div class="flex-1"><strong class="block" :class="line.status === 'cancelled' ? 'line-through text-danger' : ''">{{ line.name }}</strong><small v-if="line.servingNote || line.kitchenNote" class="font-700 text-muted">{{ [line.servingNote, line.kitchenNote].filter(Boolean).join(' · ') }}</small></div>
          <strong :class="line.status === 'cancelled' ? 'line-through text-danger' : ''">{{ money(line.status === 'cancelled' ? 0 : line.quantity * line.unitPriceCents) }}</strong>
        </div>
      </div>
      <div class="mt-20px pt-18px border-t-2 border-border flex items-center justify-between"><span class="text-20px font-900">Order total</span><strong class="font-display text-34px text-terracottaDark">{{ money(orderTotal(order)) }}</strong></div>
    </div>
    <template #footer>
      <div class="grid grid-cols-4 gap-10px">
        <button class="yf-btn" @click="$emit('edit')">Edit order</button>
        <button v-if="order?.serviceType === 'dine_in'" class="yf-btn" @click="$emit('assign')">{{ order.tableId ? 'Move table' : 'Assign table' }}</button>
        <button class="yf-btn-danger" @click="$emit('cancel')">Cancel order</button>
        <button class="yf-btn-primary" @click="$emit('checkout')">Checkout</button>
      </div>
    </template>
  </YfDialog>
</template>
