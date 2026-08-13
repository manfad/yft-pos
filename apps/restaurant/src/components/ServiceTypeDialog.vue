<script setup lang="ts">
import { shallowRef, watch } from "vue";
import { YfDialog } from "@yf/ui";
import type { ServiceType } from "../domain/types";
import TablePicker from "./TablePicker.vue";

const props = defineProps<{ open: boolean; preferredTableId?: string | null }>();
const emit = defineEmits<{ confirm: [serviceType: ServiceType, tableId: string | null]; close: [] }>();
const service = shallowRef<ServiceType | null>(null);
const tableId = shallowRef<string | null>(null);
watch(() => props.open, (open) => {
  if (open) {
    service.value = props.preferredTableId ? "dine_in" : null;
    tableId.value = props.preferredTableId ?? null;
  }
});
function choose(type: ServiceType): void { service.value = type; if (type === "takeaway") tableId.value = null; }
</script>

<template>
  <YfDialog :open="open" title="How will this order be served?" width="760px" :layer="100" :close-on-backdrop="false" @close="$emit('close')">
    <div class="p-26px">
      <div class="grid grid-cols-2 gap-18px">
        <button class="yf-card-button min-h-150px p-24px text-left" :class="service === 'dine_in' ? 'border-olive bg-successSoft' : ''" @click="choose('dine_in')">
          <strong class="block font-display text-30px">Dine in</strong><span class="block mt-8px text-16px font-700 text-muted">Assign a table now or leave it waiting.</span>
        </button>
        <button class="yf-card-button min-h-150px p-24px text-left" :class="service === 'takeaway' ? 'border-olive bg-successSoft' : ''" @click="choose('takeaway')">
          <strong class="block font-display text-30px">Takeaway</strong><span class="block mt-8px text-16px font-700 text-muted">No table is required.</span>
        </button>
      </div>
      <div v-if="service === 'dine_in'" class="mt-24px">
        <h3 class="m-0 mb-12px text-18px font-900">Table assignment</h3>
        <TablePicker v-model="tableId" />
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-12px"><button class="yf-btn" @click="$emit('close')">Back</button><button class="yf-btn-primary" :disabled="!service" @click="service && $emit('confirm', service, tableId)">Create order</button></div>
    </template>
  </YfDialog>
</template>
