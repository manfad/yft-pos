<script setup lang="ts">
import { nextTick, shallowRef, useTemplateRef, watch } from "vue";
import { YfDialog } from "@yf/ui";
import type { RestaurantOrder } from "../domain/types";
import TablePicker from "./TablePicker.vue";

const props = defineProps<{ open: boolean; order: RestaurantOrder | null }>();
defineEmits<{ confirm: [tableId: string | null]; close: [] }>();
const selected = shallowRef<string | null>(null);
const picker = useTemplateRef<InstanceType<typeof TablePicker>>("picker");
watch(() => props.open, async (open) => {
  if (!open) return;
  selected.value = props.order?.tableId ?? null;
  await nextTick();
  picker.value?.openPad();
});
</script>

<template>
  <YfDialog :open="open" title="Assign or move table" width="700px" @close="$emit('close')">
    <div class="p-26px">
      <p class="mt-0 mb-16px text-16px font-700 text-muted">Enter a table number for fast assignment, or leave this dine-in order waiting.</p>
      <TablePicker ref="picker" v-model="selected" :order-id="order?.id ?? null" />
    </div>
    <template #footer><div class="flex justify-end gap-12px"><button class="yf-btn" @click="$emit('close')">Cancel</button><button class="yf-btn-primary" @click="$emit('confirm', selected)">Save assignment</button></div></template>
  </YfDialog>
</template>
