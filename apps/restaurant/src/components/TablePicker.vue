<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { YfNumberPad } from "@yf/ui";
import type { RestaurantTable } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";

const props = withDefaults(defineProps<{ modelValue: string | null; orderId?: string | null; layer?: number }>(), { orderId: null, layer: 110 });
const emit = defineEmits<{ "update:modelValue": [tableId: string | null] }>();
const store = useRestaurantStore();
const padOpen = shallowRef(false);
const error = shallowRef("");
const tableNumber = (table: RestaurantTable): number => Number(table.label.match(/\d+/)?.[0] ?? 0);
const selected = computed(() => store.tables.find((table) => table.id === props.modelValue) ?? null);
const freeCount = computed(() => store.tables.filter((table) => !store.tableOrder(table.id) || store.tableOrder(table.id)?.id === props.orderId).length);
watch(() => props.modelValue, () => { error.value = ""; });

function openPad(): void { error.value = ""; padOpen.value = true; }
function waiting(): void { error.value = ""; emit("update:modelValue", null); }
function apply(value: number): void {
  const number = Math.round(value);
  const table = store.tables.find((entry) => tableNumber(entry) === number);
  const taken = table ? store.tableOrder(table.id) : undefined;
  padOpen.value = false;
  if (!table) { error.value = `Table ${number} does not exist.`; return; }
  if (taken && taken.id !== props.orderId) { error.value = `${table.label} is taken by order #${String(taken.dailyNumber).padStart(3, "0")}.`; return; }
  emit("update:modelValue", table.id);
}
defineExpose({ openPad });
</script>

<template>
  <div>
    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-12px">
      <button class="yf-card-button min-h-104px px-20px py-16px text-left" :class="modelValue ? 'border-olive bg-successSoft' : ''" @click="openPad">
        <span class="block text-13px font-900 text-muted uppercase">Table number</span>
        <strong class="block mt-6px font-display text-32px" :class="selected ? 'text-ink' : 'text-faint'">{{ selected?.label ?? "Tap to enter" }}</strong>
      </button>
      <button class="yf-btn min-w-180px min-h-104px leading-tight" :class="modelValue === null ? 'bg-occupied border-warmBorder' : ''" :aria-pressed="modelValue === null" @click="waiting">Waiting<br />for table</button>
    </div>
    <p v-if="error" class="mt-10px mb-0 text-15px font-900 text-danger" role="alert">{{ error }}</p>
    <p v-else class="mt-10px mb-0 text-14px font-800 text-muted">{{ freeCount }} of {{ store.tables.length }} tables free.</p>
    <YfNumberPad :open="padOpen" title="Enter table number" :initial="selected ? tableNumber(selected) : 0" :layer="layer" @confirm="apply" @close="padOpen = false" />
  </div>
</template>
