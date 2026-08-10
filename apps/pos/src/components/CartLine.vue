<script setup lang="ts">
import { computed } from "vue";
import { appliedTier, fmtMoney, fmtQty, fmtQtyUnit, unitLabel } from "@yf/core";
import { productImage } from "../productImage";
import { tintFromName } from "../tint";
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
const qtyValue = computed(() => fmtQty(props.line.qtyMilli));
const qtyUnit = computed(() => unitLabel(props.line.item.unit, props.line.qtyMilli));
const bulkTier = computed(() => appliedTier(props.line.item, props.line.qtyMilli));
const bulkTitle = computed(() =>
  bulkTier.value
    ? `Bulk price applied from ${fmtQtyUnit(bulkTier.value.minQtyMilli, props.line.item.unit)}`
    : "",
);
// Column template mirrors TillView's header. The extra tail column only exists
// when the cart has at least one tail-tracking line.
const cols = computed(() =>
  props.hasTail ? "cart-grid-tail" : "cart-grid-standard",
);
</script>

<template>
  <div
    class="cart-line grid items-center gap-8px px-12px py-12px rounded-16px cursor-pointer border-2 transition-colors"
    :class="[cols, active ? 'bg-[#fbeede] border-terracotta' : 'bg-line border-[#ece3d2]']"
    @click="$emit('select')"
  >
    <!-- ITEM -->
    <div class="cart-item flex items-center gap-12px min-w-0">
      <div
        class="cart-image w-46px h-46px flex-none rounded-full flex items-center justify-center text-18px font-800 text-ink/70"
        :style="{
          backgroundColor: tintFromName(line.item.name),
          backgroundImage: img ? `url('${img}')` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }"
      >
        <span v-if="!img">{{ line.item.name.charAt(0).toUpperCase() }}</span>
      </div>
      <div class="min-w-0 flex items-center gap-7px">
        <div class="cart-name min-w-0 max-w-full text-18px font-800 truncate">{{ line.item.name }}</div>
        <span
          v-if="bulkTier"
          class="flex-none rounded-full bg-oliveDark text-white text-10px font-900 leading-none px-7px py-3px tracking-wide"
          :title="bulkTitle"
        >BULK</span>
      </div>
    </div>

    <!-- TAIL ("ekor") — only when the cart has tail-tracking lines -->
    <div v-if="hasTail" class="cart-tail flex items-center justify-center gap-8px">
      <template v-if="line.item.tracksTail">
        <button
          class="cart-step w-40px h-40px flex-none rounded-full border-2 border-olive bg-surface text-21px font-800 text-ink cursor-pointer press"
          @click.stop="$emit('stepTail', -1)"
        >−</button>
        <div class="cart-value-stack flex-1 min-w-0 flex flex-col items-center">
          <button
            class="cart-value w-full min-w-0 min-h-44px flex items-center justify-center rounded-10px px-6px py-2px border-2 cursor-pointer press"
            :class="line.tailCount > 0 ? 'bg-[#eef0e0] border-[#b9c49f] text-ink' : 'bg-[#fbe3df] border-[#e0a99f] text-[#c23a2b]'"
            title="Tap to type Ekor"
            @click.stop="$emit('editTail')"
          >
            <span class="cart-value-number font-display text-24px font-600 leading-none">{{ line.tailCount }}</span>
          </button>
        </div>
        <button
          class="cart-step w-40px h-40px flex-none rounded-full border-2 border-olive bg-surface text-21px font-800 text-ink cursor-pointer press"
          @click.stop="$emit('stepTail', 1)"
        >+</button>
      </template>
    </div>

    <!-- QTY -->
    <div class="cart-qty-group flex items-center justify-center gap-8px">
      <button
        class="cart-step w-40px h-40px flex-none rounded-full border-2 border-border bg-surface text-21px font-800 text-ink cursor-pointer press"
        @click.stop="$emit('step', -1)"
      >−</button>
      <div class="cart-value-stack flex-1 min-w-0 flex flex-col items-center gap-3px">
        <button
          class="cart-value w-full min-w-0 min-h-44px flex items-center justify-center bg-[#f4ecdc] rounded-10px px-6px py-2px border-2 border-[#d7c9ad] cursor-pointer press"
          title="Tap to type quantity"
          @click.stop="$emit('edit')"
        >
          <span class="cart-value-number font-display text-24px font-600 leading-none">{{ qtyValue }}</span>
        </button>
        <small class="cart-value-unit text-10px font-900 leading-none text-muted">{{ qtyUnit }}</small>
      </div>
      <button
        class="cart-step w-40px h-40px flex-none rounded-full border-2 border-border bg-surface text-21px font-800 text-ink cursor-pointer press"
        @click.stop="$emit('step', 1)"
      >+</button>
    </div>

    <!-- PRICE -->
    <div class="cart-price text-right font-display text-22px font-600 whitespace-nowrap">{{ fmtMoney(amountCents) }}</div>

    <!-- REMOVE -->
    <button
      class="cart-remove w-40px h-40px flex-none rounded-full border-none bg-[#d94b3d] text-17px font-900 text-white cursor-pointer shadow-[0_3px_0_#a9372d] transition-transform active:translate-y-2px active:shadow-none"
      @click.stop="$emit('remove')"
    >✕</button>
  </div>
</template>

<style scoped>
.cart-qty-group {
  padding-inline-start: 8px;
}

@media (max-width: 1100px) {
  .cart-line {
    padding-inline: 8px;
  }
  .cart-image {
    display: none;
  }
  .cart-name {
    font-size: 16px;
  }
  .cart-qty-group {
    padding-inline-start: 6px;
  }
  .cart-step {
    width: 34px;
    height: 34px;
    font-size: 18px;
  }
  .cart-price {
    font-size: 20px;
  }
  .cart-remove {
    width: 38px;
    height: 38px;
  }
}
</style>
