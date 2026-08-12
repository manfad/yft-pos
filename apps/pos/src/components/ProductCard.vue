<script setup lang="ts">
import { computed } from "vue";
import { isStockTracked, type PricedItem } from "@yf/core";
import { productImage } from "../productImage";
import { tintFromName } from "../tint";

const props = defineProps<{ item: PricedItem }>();
defineEmits<{ add: [] }>();

const img = computed(() => productImage(props.item.image));
// Sold out (tracked stock ran dry): grayed but still tappable — the till
// answers the tap with a "please add more stock" popup instead of adding.
const soldOut = computed(() => isStockTracked(props.item) && props.item.stockMilli! <= 0);
</script>

<template>
  <button
    :title="soldOut ? `${item.name} — out of stock` : item.name"
    class="relative h-full min-h-0 border-2 rounded-18px cursor-pointer p-10px overflow-hidden transition-all active:translate-y-3px active:shadow-none"
    :class="
      soldOut
        ? 'bg-[#e8e4dc] border-[#d5cfc4] shadow-none grayscale opacity-70'
        : 'bg-surface border-border shadow-[0_3px_0_theme(colors.border)] active:border-terracotta'
    "
    @click="$emit('add')"
  >
    <!-- photo, or name fallback when there's no image -->
    <div
      v-if="img"
      class="w-full h-full rounded-14px"
      :style="{
        backgroundColor: '#fff',
        backgroundImage: `url('${img}')`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }"
    />
    <div
      v-else
      class="w-full h-full rounded-14px flex items-center justify-center px-6px"
      :style="{ backgroundColor: soldOut ? '#ddd8ce' : tintFromName(item.name) }"
    >
      <span class="text-17px font-800 text-ink leading-tight text-center line-clamp-3">{{ item.name }}</span>
    </div>

    <span
      v-if="soldOut"
      class="absolute inset-x-0 bottom-8px mx-auto w-fit bg-[#6d675e] text-white text-11px font-900 tracking-wide leading-none px-8px py-4px rounded-full"
    >OUT OF STOCK</span>
    <span
      v-else-if="item.tiers.length"
      class="absolute top-4px right-4px bg-olive text-white text-11px font-800 leading-none px-6px py-3px rounded-full shadow-[0_2px_4px_rgba(0,0,0,.2)]"
      title="Bulk price available"
    >★</span>
  </button>
</template>
