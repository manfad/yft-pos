<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { YfDialog, YfNumberPad } from "@yf/ui";
import { lineTotal, money } from "../domain/restaurant";
import type { MenuItem, OrderLine, RestaurantOrder } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";
import ItemConfigDialog from "./ItemConfigDialog.vue";

const props = defineProps<{ open: boolean; order?: RestaurantOrder | null; initialLines?: OrderLine[] }>();
const emit = defineEmits<{ place: [lines: OrderLine[]]; save: [lines: OrderLine[]]; close: [] }>();
const store = useRestaurantStore();
const lines = ref<OrderLine[]>([]);
const category = ref("All");
const config = reactive<{ open: boolean; item: MenuItem | null; line: OrderLine | null }>({ open: false, item: null, line: null });
const numberEdit = reactive<{ open: boolean; line: OrderLine | null; field: "quantity" | "price" }>({ open: false, line: null, field: "quantity" });

watch(() => props.open, (open) => {
  if (open) { lines.value = (props.order?.lines ?? props.initialLines ?? []).map((line) => ({ ...line })); category.value = "All"; }
});
const availableItems = computed(() => store.menuItems.filter((item) => !item.archived && item.available && !item.checkoutOnly));
const categories = computed(() => ["All", ...new Set(availableItems.value.map((item) => item.category))]);
const visibleItems = computed(() => category.value === "All" ? availableItems.value : availableItems.value.filter((item) => item.category === category.value));
const total = computed(() => lines.value.reduce((sum, line) => sum + lineTotal(line), 0));
const hasActiveLines = computed(() => lines.value.some((line) => line.status === "active"));

function choose(item: MenuItem): void {
  if (item.pricingMode === "variable") { config.item = item; config.line = null; config.open = true; return; }
  const existing = lines.value.find((line) => line.menuItemId === item.id && line.status === "active" && !line.servingNote && !line.kitchenNote);
  if (existing) { existing.quantity += 1; existing.totalPriceCents = (existing.totalPriceCents ?? (existing.quantity - 1) * existing.unitPriceCents) + item.priceCents; }
  else lines.value.push({ id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, menuItemId: item.id, name: item.name, quantity: 1, unitPriceCents: item.priceCents, totalPriceCents: item.priceCents, servingNote: "", kitchenNote: "", status: "active" });
}
function configured(line: OrderLine): void {
  const index = lines.value.findIndex((item) => item.id === line.id);
  if (index >= 0) lines.value[index] = line;
  else lines.value.push(line);
  config.open = false;
}
function editLine(line: OrderLine): void {
  const item = store.menuItems.find((entry) => entry.id === line.menuItemId);
  if (!item || line.status === "cancelled") return;
  config.item = item; config.line = line; config.open = true;
}
function editNumber(line: OrderLine, field: "quantity" | "price"): void { if (line.status === "cancelled") return; numberEdit.line = line; numberEdit.field = field; numberEdit.open = true; }
function saveNumber(value: number): void { const line = numberEdit.line; if (!line) return; if (numberEdit.field === "quantity") line.quantity = Math.max(1, Math.round(value)); else line.totalPriceCents = Math.max(0, Math.round(value * 100)); numberEdit.open = false; }
function toggleLine(line: OrderLine): void { if (line.status === "cancelled") { line.status = "active"; delete line.cancelledAt; } else if (props.order) { line.status = "cancelled"; line.cancelledAt = new Date().toISOString(); } else lines.value = lines.value.filter((item) => item.id !== line.id); }
function submit(): void { if (hasActiveLines.value) props.order ? emit("save", lines.value) : emit("place", lines.value); }
</script>

<template>
  <YfDialog :open="open" :title="order ? `Edit order #${String(order.dailyNumber).padStart(3, '0')}` : 'New order'" width="1420px" :close-on-backdrop="false" @close="$emit('close')">
    <div class="h-[min(750px,calc(94vh-174px))] grid grid-cols-[minmax(0,1fr)_500px]">
      <section class="min-w-0 flex flex-col border-r-2 border-borderSoft" aria-label="Menu">
        <div class="flex-none flex gap-10px p-18px overflow-x-auto border-b-2 border-borderSoft">
          <button v-for="name in categories" :key="name" class="yf-btn whitespace-nowrap" :class="category === name ? 'bg-ink text-white border-ink' : ''" @click="category = name">{{ name }}</button>
        </div>
        <div class="flex-1 overflow-auto p-20px grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] auto-rows-130px gap-16px content-start">
          <button v-for="item in visibleItems" :key="item.id" class="yf-card-button p-18px flex flex-col justify-between text-left" @click="choose(item)">
            <span class="text-21px font-900 leading-tight">{{ item.name }}</span>
            <span class="flex items-end justify-between gap-8px">
              <span class="text-14px font-800 text-muted">{{ item.category }}</span>
              <span class="font-display text-22px font-700 text-terracottaDark whitespace-nowrap">{{ item.pricingMode === "variable" ? "Set price" : money(item.priceCents) }}</span>
            </span>
          </button>
        </div>
      </section>
      <section class="min-w-0 flex flex-col bg-panel" aria-label="Order cart">
        <div class="flex-none px-22px py-18px flex items-center justify-between border-b-2 border-borderSoft">
          <h3 class="m-0 text-22px font-900">Order cart</h3><span class="yf-chip bg-warm text-terracottaDark">{{ lines.filter(line => line.status === 'active').length }} items</span>
        </div>
        <div class="flex-1 overflow-auto p-16px flex flex-col gap-12px">
          <div v-if="!lines.length" class="flex-1 grid place-items-center text-center text-19px font-800 text-muted">Tap a menu card to add an item</div>
          <div v-if="lines.length" class="grid grid-cols-[52px_minmax(0,1fr)_90px_130px] gap-8px px-8px text-13px font-900 text-muted uppercase"><span /><span>Name</span><span class="text-center">Qty</span><span class="text-right">Price</span></div>
          <article v-for="line in lines" :key="line.id" class="grid grid-cols-[52px_minmax(0,1fr)_90px_130px] gap-8px items-center min-h-70px px-10px rounded-16px border-2 border-border bg-surface" :class="line.status === 'cancelled' ? 'opacity-55 bg-panel' : ''">
            <button class="yf-btn min-h-44px h-44px w-44px px-0 text-22px" :class="line.status === 'cancelled' ? 'text-oliveDark border-olive' : 'text-danger border-danger'" :aria-label="line.status === 'cancelled' ? `Recover ${line.name}` : `Cancel ${line.name}`" @click="toggleLine(line)">{{ line.status === 'cancelled' ? '↶' : '×' }}</button>
            <button class="min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer" :disabled="line.status === 'cancelled'" @click="editLine(line)"><strong class="block text-17px truncate" :class="line.status === 'cancelled' ? 'line-through' : ''">{{ line.name }}</strong></button>
            <button class="yf-btn min-h-44px h-44px px-8px text-18px" :disabled="line.status === 'cancelled'" @click="editNumber(line, 'quantity')">{{ line.quantity }}</button>
            <button class="yf-btn min-h-44px h-44px px-8px text-17px text-right" :disabled="line.status === 'cancelled'" @click="editNumber(line, 'price')">{{ money(line.status === 'cancelled' ? (line.totalPriceCents ?? line.quantity * line.unitPriceCents) : lineTotal(line)) }}</button>
          </article>
        </div>
        <div class="flex-none px-22px py-18px bg-surface border-t-2 border-borderSoft flex items-center justify-between">
          <span class="text-19px font-900">Total</span><strong class="font-display text-34px text-terracottaDark">{{ money(total) }}</strong>
        </div>
      </section>
    </div>
    <template #footer>
      <div class="flex items-center justify-end gap-12px">
        <button class="yf-btn" @click="$emit('close')">Discard changes</button>
        <button class="yf-btn-primary min-w-190px" :disabled="!hasActiveLines" @click="submit">{{ order ? "Save changes" : "Place order" }}</button>
      </div>
    </template>
  </YfDialog>
  <ItemConfigDialog :open="config.open" :item="config.item" :line="config.line" @add="configured" @close="config.open = false" />
  <YfNumberPad :open="numberEdit.open" :title="numberEdit.field === 'quantity' ? 'Change quantity' : 'Change agreed price'" :initial="numberEdit.line ? (numberEdit.field === 'quantity' ? numberEdit.line.quantity : (numberEdit.line.totalPriceCents ?? numberEdit.line.quantity * numberEdit.line.unitPriceCents) / 100) : 0" :money="numberEdit.field === 'price'" :layer="120" @confirm="saveNumber" @close="numberEdit.open = false" />
</template>
