<script setup lang="ts">
import { computed } from "vue";
import type { PricedItem } from "@yf/core";
import { productImage } from "../productImage";

const props = defineProps<{ item: PricedItem }>();
defineEmits<{ add: [] }>();

const img = computed(() => productImage(props.item.image));
</script>

<template>
  <button
    :title="item.name"
    class="relative h-128px bg-surface border-2 border-border rounded-18px cursor-pointer shadow-[0_3px_0_theme(colors.border)] p-10px overflow-hidden transition-all active:translate-y-3px active:shadow-none active:border-terracotta"
    @click="$emit('add')"
  >
    <!-- photo, or name fallback when there's no image -->
    <div
      v-if="img"
      class="w-full h-full rounded-14px"
      :style="{
        backgroundColor: item.tint,
        backgroundImage: `url('${img}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }"
    />
    <div
      v-else
      class="w-full h-full rounded-14px flex items-center justify-center px-6px"
      :style="{ backgroundColor: item.tint }"
    >
      <span class="text-17px font-800 text-ink leading-tight text-center line-clamp-3">{{ item.name }}</span>
    </div>

    <span
      v-if="item.tiers.length"
      class="absolute top-8px right-8px bg-olive text-white text-12px font-800 leading-none px-7px py-3px rounded-full shadow-[0_2px_4px_rgba(0,0,0,.2)]"
      title="Bulk price available"
    >★</span>
  </button>
</template>
