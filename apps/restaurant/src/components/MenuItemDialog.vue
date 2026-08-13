<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { YfDialog, YfKeyboard, YfNumberPad, YfSelect, YfSwitch } from "@yf/ui";
import { money } from "../domain/restaurant";
import type { MenuItem } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";

const props = defineProps<{ open: boolean; item: MenuItem | null }>();
const emit = defineEmits<{ save: [item: Omit<MenuItem, "id" | "sortOrder"> & { id?: string }]; close: [] }>();
const store = useRestaurantStore();
const form = reactive({ id: undefined as string | undefined, name: "", category: "", variablePricing: false, priceCents: 0, checkoutOnly: false, hidden: false, archived: false });
const keyboardOpen = reactive({ value: false });
const priceOpen = reactive({ value: false });
const categoryOptions = computed(() => store.categories.map((name) => ({ value: name, label: name })));
watch(() => props.open, (open) => {
  if (!open) return;
  const item = props.item;
  Object.assign(form, item ? { id: item.id, name: item.name, category: item.category, variablePricing: item.pricingMode === "variable", priceCents: item.priceCents, checkoutOnly: item.checkoutOnly, hidden: !item.available, archived: item.archived } : { id: undefined, name: "", category: store.categories[0] ?? "", variablePricing: false, priceCents: 0, checkoutOnly: false, hidden: false, archived: false });
});
function save(): void {
  if (!form.name.trim() || !form.category || form.priceCents <= 0) return;
  emit("save", { id: form.id, name: form.name.trim(), category: form.category, pricingMode: form.variablePricing ? "variable" : "fixed", priceCents: form.priceCents, checkoutOnly: form.checkoutOnly, available: !form.hidden, archived: form.archived });
}
</script>

<template>
  <YfDialog :open="open" :title="item ? 'Edit menu item' : 'Add menu item'" width="680px" @close="$emit('close')">
    <div class="p-28px flex flex-col gap-18px">
      <button class="yf-card-button min-h-96px p-18px text-left" @click="keyboardOpen.value = true"><span class="block text-13px font-900 text-muted uppercase">Item name</span><strong class="block mt-7px text-22px">{{ form.name || 'Tap to enter item name' }}</strong></button>
      <YfSelect v-model="form.category" label="Category" :options="categoryOptions" />
      <button class="yf-card-button min-h-96px p-18px text-left" @click="priceOpen.value = true"><span class="block text-13px font-900 text-muted uppercase">{{ form.variablePricing ? 'Default price' : 'Price' }}</span><strong class="block mt-7px font-display text-30px text-terracottaDark">{{ money(form.priceCents) }}</strong></button>
      <div class="yf-card px-18px py-8px"><YfSwitch v-model="form.variablePricing" label="Variable pricing" description="Opens quantity and agreed-price configuration when ordered." /></div>
      <div class="yf-card px-18px py-8px divide-y divide-borderSoft">
        <YfSwitch v-model="form.hidden" label="Hide from order menu" />
        <YfSwitch v-model="form.checkoutOnly" label="Checkout-only add-on" description="Shown only when Add item is used during checkout." />
        <YfSwitch v-model="form.archived" label="Archived" description="Keeps history but removes the item from normal use." />
      </div>
    </div>
    <template #footer><div class="flex justify-end gap-12px"><button class="yf-btn" @click="$emit('close')">Cancel</button><button class="yf-btn-primary" :disabled="!form.name.trim() || !form.category || form.priceCents <= 0" @click="save">Save item</button></div></template>
  </YfDialog>
  <YfKeyboard :open="keyboardOpen.value" title="Item name" :initial="form.name" @confirm="value => { form.name = value; keyboardOpen.value = false }" @close="keyboardOpen.value = false" />
  <YfNumberPad :open="priceOpen.value" title="Item price" :initial="form.priceCents / 100" money @confirm="value => { form.priceCents = Math.round(value * 100); priceOpen.value = false }" @close="priceOpen.value = false" />
</template>
