<script setup lang="ts">
import { reactive, watch } from "vue";
import { YfDialog, YfNumberPad } from "@yf/ui";
import { money } from "../domain/restaurant";
import type { MenuItem, OrderLine } from "../domain/types";

const props = defineProps<{ open: boolean; item: MenuItem | null; line?: OrderLine | null }>();
const emit = defineEmits<{ add: [line: OrderLine]; close: [] }>();
const form = reactive({ quantity: 1, priceCents: 0 });
const pad = reactive({ open: false, field: "price" as "price" | "quantity" });

watch(() => props.open, (open) => {
  if (!open || !props.item) return;
  form.quantity = props.line?.quantity ?? 1;
  form.priceCents = props.line ? (props.line.totalPriceCents ?? props.line.quantity * props.line.unitPriceCents) : props.item.priceCents;
});

function openPad(field: "price" | "quantity"): void { pad.field = field; pad.open = true; }
function setNumber(value: number): void {
  if (pad.field === "price") form.priceCents = Math.round(value * 100);
  else form.quantity = Math.max(1, Math.round(value));
  pad.open = false;
}
function submit(): void {
  if (!props.item || form.priceCents <= 0) return;
  emit("add", {
    id: props.line?.id ?? `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    menuItemId: props.item.id,
    name: props.item.name,
    quantity: form.quantity,
    unitPriceCents: props.line?.unitPriceCents ?? props.item.priceCents,
    totalPriceCents: form.priceCents,
    servingNote: props.line?.servingNote ?? "",
    kitchenNote: props.line?.kitchenNote ?? "",
    status: props.line?.status ?? "active"
  });
}
</script>

<template>
  <YfDialog :open="open" :title="item ? `Configure ${item.name}` : 'Configure item'" width="620px" :layer="100" @close="$emit('close')">
    <div v-if="item" class="p-28px flex flex-col gap-20px">
      <button class="yf-card-button min-h-112px p-20px text-left" @click="openPad('quantity')"><span class="block text-14px font-900 text-muted uppercase">Quantity</span><span class="block mt-8px font-display text-38px font-700">{{ form.quantity }}</span></button>
      <button class="yf-card-button min-h-112px p-20px text-left" @click="openPad('price')"><span class="block text-14px font-900 text-muted uppercase">Agreed total price</span><span class="block mt-8px font-display text-38px font-700 text-terracottaDark">{{ money(form.priceCents) }}</span></button>
    </div>
    <template #footer>
      <div class="flex justify-end gap-12px">
        <button class="yf-btn" @click="$emit('close')">Cancel</button>
        <button class="yf-btn-primary" :disabled="form.priceCents <= 0" @click="submit">{{ line ? "Update item" : "Add to order" }}</button>
      </div>
    </template>
  </YfDialog>
  <YfNumberPad :open="pad.open" :title="pad.field === 'price' ? 'Enter item price' : 'Enter quantity'" :initial="pad.field === 'price' ? form.priceCents / 100 : form.quantity" :money="pad.field === 'price'" :layer="120" @confirm="setNumber" @close="pad.open = false" />
</template>
