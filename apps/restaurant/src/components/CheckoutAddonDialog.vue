<script setup lang="ts">
import { YfDialog } from "@yf/ui";
import { money } from "../domain/restaurant";
import type { MenuItem } from "../domain/types";

defineProps<{ open: boolean; items: MenuItem[] }>();
defineEmits<{ add: [item: MenuItem]; close: [] }>();
</script>

<template>
  <YfDialog :open="open" title="Add checkout item" width="720px" :layer="100" @close="$emit('close')">
    <div class="p-24px grid grid-cols-2 gap-14px"><button v-for="item in items" :key="item.id" class="yf-card-button min-h-112px p-18px text-left" @click="$emit('add', item)"><strong class="block text-22px">{{ item.name }}</strong><span class="block mt-8px font-display text-23px text-terracottaDark">{{ money(item.priceCents) }} each</span></button><p v-if="!items.length" class="col-span-2 text-center text-17px font-800 text-muted">No checkout-only items are available.</p></div>
    <template #footer><div class="flex justify-end"><button class="yf-btn" @click="$emit('close')">Done</button></div></template>
  </YfDialog>
</template>
