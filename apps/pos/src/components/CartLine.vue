<script setup lang="ts">
import { computed } from "vue";
import { appliedTier, fmtMoney, fmtQtyUnit } from "@yf/core";
import { productImage } from "../productImage";
import type { CartLine } from "../stores/cart";

const props = defineProps<{
  line: CartLine;
  active: boolean;
  amountCents: number;
  /** True when any line in the cart tracks tail — keeps the grid aligned with the header. */
  hasTail: boolean;
}>();
defineEmits<{
  select: [];
  step: [delta: number];
  edit: [];
  stepTail: [delta: number];
  editTail: [];
  remove: [];
}>();

const img = computed(() => productImage(props.line.item.image));
const qtyStr = computed(() => fmtQtyUnit(props.line.qtyMilli, props.line.item.unit));
const bulkTier = computed(() => appliedTier(props.line.item, props.line.qtyMilli));
const bulkLabel = computed(() =>
  bulkTier.value ? fmtQtyUnit(bulkTier.value.minQtyMilli, props.line.item.unit) : "",
);
// Column template mirrors TillView's header. The extra tail column only exists
// when the cart has at least one tail-tracking line.
const cols = computed(() =>
  props.hasTail
    ? "grid-cols-[minmax(0,1fr)_172px_188px_138px_44px]"
    : "grid-cols-[minmax(0,1fr)_220px_150px_44px]",
);
</script>

<template>
  <div
    class="grid items-center gap-10px px-14px py-12px rounded-16px cursor-pointer border-2 transition-colors"
    :class="[cols, active ? 'bg-[#fbeede] border-terracotta' : 'bg-line border-[#ece3d2]']"
    @click="$emit('select')"
  >
    <!-- ITEM -->
    <div class="flex items-center gap-12px min-w-0">
      <div
        class="w-46px h-46px flex-none rounded-full flex items-center justify-center text-18px font-800 text-ink/70"
        :style="{
          backgroundColor: line.item.tint,
          backgroundImage: img ? `url('${img}')` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }"
      >
        <span v-if="!img">{{ line.item.name.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="min-w-0 flex items-center gap-8px">
        <div class="text-18px font-800 truncate">{{ line.item.name }}</div>
        <span
          v-if="bulkTier"
          class="flex-none text-13px font-800 rounded-full px-9px py-2px bg-olive text-white whitespace-nowrap"
          title="Bulk price applied"
        >{{ bulkLabel }} bulk</span>
      </div>
    </div>

    <!-- TAIL ("ekor") — only when the cart has tail-tracking lines -->
    <div v-if="hasTail" class="flex items-center justify-center gap-8px">
      <template v-if="line.item.tracksTail">
        <button
          class="w-44px h-44px flex-none rounded-full border-2 border-olive bg-surface text-24px font-800 text-ink cursor-pointer press"
          @click.stop="$emit('stepTail', -1)"
        >−</button>
        <button
          class="flex-1 min-w-0 text-center font-display text-21px font-600 rounded-10px px-6px py-4px border-2 cursor-pointer press truncate"
          :class="line.tailCount > 0 ? 'bg-[#eef0e0] border-transparent text-ink' : 'bg-[#fbe3df] border-[#e0a99f] text-[#c23a2b]'"
          title="Tap to type Ekor"
          @click.stop="$emit('editTail')"
        >{{ line.tailCount }}</button>
        <button
          class="w-44px h-44px flex-none rounded-full border-2 border-olive bg-surface text-24px font-800 text-ink cursor-pointer press"
          @click.stop="$emit('stepTail', 1)"
        >+</button>
      </template>
    </div>

    <!-- QTY -->
    <div class="flex items-center justify-center gap-10px">
      <button
        class="w-44px h-44px flex-none rounded-full border-2 border-border bg-surface text-24px font-800 text-ink cursor-pointer press"
        @click.stop="$emit('step', -1)"
      >−</button>
      <button
        class="flex-1 min-w-0 text-center font-display text-21px font-600 bg-[#f4ecdc] rounded-10px px-6px py-4px border-2 border-transparent cursor-pointer press truncate"
        title="Tap to type quantity"
        @click.stop="$emit('edit')"
      >{{ qtyStr }}</button>
      <button
        class="w-44px h-44px flex-none rounded-full border-2 border-border bg-surface text-24px font-800 text-ink cursor-pointer press"
        @click.stop="$emit('step', 1)"
      >+</button>
    </div>

    <!-- PRICE -->
    <div class="text-right font-display text-24px font-600 whitespace-nowrap">{{ fmtMoney(amountCents) }}</div>

    <!-- REMOVE -->
    <button
      class="w-42px h-42px flex-none rounded-full border-none bg-[#d94b3d] text-17px font-900 text-white cursor-pointer shadow-[0_3px_0_#a9372d] transition-transform active:translate-y-2px active:shadow-none"
      @click.stop="$emit('remove')"
    >✕</button>
  </div>
</template>
