<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { YfDialog, YfNumberPad } from "@yf/ui";
import { lineTotal, money } from "../domain/restaurant";
import type { MenuItem, OrderLine, PaymentMethod, RestaurantOrder } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";
import CheckoutAddonDialog from "./CheckoutAddonDialog.vue";
import PaymentMethodDialog from "./PaymentMethodDialog.vue";

const props = defineProps<{ open: boolean; order: RestaurantOrder | null }>();
const emit = defineEmits<{ confirm: [lines: OrderLine[], method: PaymentMethod, receivedCents?: number]; close: [] }>();
const store = useRestaurantStore();
const lines = ref<OrderLine[]>([]);
const addonsOpen = shallowRef(false);
const paymentOpen = shallowRef(false);
const quantityLine = ref<OrderLine | null>(null);
watch(() => props.open, (open) => { if (open) { lines.value = (props.order?.lines ?? []).map((line) => ({ ...line })); addonsOpen.value = false; paymentOpen.value = false; } });
const addons = computed(() => store.menuItems.filter((item) => item.checkoutOnly && item.available && !item.archived));
const total = computed(() => lines.value.reduce((sum, line) => sum + lineTotal(line), 0));
const hasActive = computed(() => lines.value.some((line) => line.status === "active"));
function add(item: MenuItem): void { const existing = lines.value.find((line) => line.menuItemId === item.id && line.status === "active"); if (existing) { existing.quantity += 1; existing.totalPriceCents = (existing.totalPriceCents ?? (existing.quantity - 1) * existing.unitPriceCents) + item.priceCents; } else lines.value.push({ id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, menuItemId: item.id, name: item.name, quantity: 1, unitPriceCents: item.priceCents, totalPriceCents: item.priceCents, servingNote: "", kitchenNote: "", status: "active" }); }
function toggle(line: OrderLine): void { if (line.status === "cancelled") { line.status = "active"; delete line.cancelledAt; } else { line.status = "cancelled"; line.cancelledAt = new Date().toISOString(); } }
function setQuantity(value: number): void { if (quantityLine.value) { const line = quantityLine.value; const oldQty = Math.max(1, line.quantity); const oldTotal = line.totalPriceCents ?? oldQty * line.unitPriceCents; line.quantity = Math.max(1, Math.round(value)); line.totalPriceCents = Math.round(oldTotal / oldQty * line.quantity); } quantityLine.value = null; }
function paid(method: PaymentMethod, receivedCents?: number): void { emit("confirm", lines.value, method, receivedCents); paymentOpen.value = false; }
</script>

<template>
  <YfDialog :open="open" :title="order ? `Checkout order #${String(order.dailyNumber).padStart(3, '0')}` : 'Checkout order'" width="980px" :close-on-backdrop="false" @close="$emit('close')">
    <div class="h-[min(650px,calc(94vh-174px))] p-24px flex flex-col">
      <div class="grid grid-cols-[58px_minmax(0,1fr)_110px_150px] gap-10px px-10px pb-10px text-14px font-900 text-muted uppercase"><span /><span>Item</span><span class="text-center">Qty</span><span class="text-right">Price</span></div>
      <div class="flex-1 min-h-0 overflow-auto flex flex-col gap-10px">
        <article v-for="line in lines" :key="line.id" class="grid grid-cols-[58px_minmax(0,1fr)_110px_150px] gap-10px items-center min-h-70px px-10px rounded-16px border-2 border-border bg-surface" :class="line.status === 'cancelled' ? 'opacity-55 bg-panel' : ''">
          <button class="yf-btn min-h-46px h-46px w-46px px-0 text-23px" :class="line.status === 'cancelled' ? 'text-oliveDark border-olive' : 'text-danger border-danger'" :aria-label="line.status === 'cancelled' ? `Recover ${line.name}` : `Cancel ${line.name}`" @click="toggle(line)">{{ line.status === 'cancelled' ? '↶' : '×' }}</button>
          <strong class="text-18px truncate" :class="line.status === 'cancelled' ? 'line-through' : ''">{{ line.name }}</strong>
          <button class="yf-btn min-h-46px h-46px text-18px" :disabled="line.status === 'cancelled'" @click="quantityLine = line">{{ line.quantity }}</button>
          <strong class="text-right text-18px" :class="line.status === 'cancelled' ? 'line-through' : ''">{{ money(line.status === 'cancelled' ? (line.totalPriceCents ?? line.quantity * line.unitPriceCents) : lineTotal(line)) }}</strong>
        </article>
      </div>
      <div class="mt-18px pt-16px border-t-2 border-border flex items-center"><strong class="text-20px">Total</strong><strong class="ml-auto font-display text-38px text-terracottaDark">{{ money(total) }}</strong></div>
    </div>
    <template #footer><div class="flex items-center justify-between"><button class="yf-btn min-w-150px" @click="addonsOpen = true">+ Add item</button><div class="flex gap-10px"><button class="yf-btn" @click="$emit('close')">Back</button><button class="yf-btn-primary min-w-160px" :disabled="!hasActive" @click="paymentOpen = true">Pay</button></div></div></template>
  </YfDialog>
  <CheckoutAddonDialog :open="addonsOpen" :items="addons" @add="add" @close="addonsOpen = false" />
  <PaymentMethodDialog :open="paymentOpen" :total-cents="total" @confirm="paid" @close="paymentOpen = false" />
  <YfNumberPad :open="quantityLine !== null" title="Change quantity" :initial="quantityLine?.quantity ?? 1" :layer="110" @confirm="setQuantity" @close="quantityLine = null" />
</template>
