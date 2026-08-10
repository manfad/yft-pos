<script setup lang="ts">
import { computed, onUnmounted, watch } from "vue";
import {
  effectiveUnitPrice,
  fmtMoney,
  fmtQty,
  fmtQtyUnit,
  lineAmount,
  unitLabel,
} from "@yf/core";
import type { CartLine } from "../stores/cart";

const props = defineProps<{
  open: boolean;
  line: CartLine | null;
}>();

const emit = defineEmits<{
  close: [];
  adjustQty: [delta: number];
  editQty: [];
  adjustTail: [delta: number];
  editTail: [];
}>();

const unitPriceCents = computed(() => {
  const line = props.line;
  return line ? effectiveUnitPrice(line.item, line.qtyMilli) : 0;
});
const qtyText = computed(() => {
  const line = props.line;
  return line ? fmtQty(line.qtyMilli) : "—";
});
const qtyUnitText = computed(() => {
  const line = props.line;
  return line ? unitLabel(line.item.unit, line.qtyMilli) : "";
});
const tailText = computed(() => `${props.line?.tailCount ?? 0}`);
const amountText = computed(() => {
  const line = props.line;
  return line ? fmtMoney(lineAmount(unitPriceCents.value, line.qtyMilli)) : fmtMoney(0);
});
const mathText = computed(() => {
  const line = props.line;
  if (!line) return "";
  return `${fmtMoney(unitPriceCents.value)} × ${fmtQtyUnit(line.qtyMilli, line.item.unit)} = ${amountText.value}`;
});
const tiers = computed(() => {
  const line = props.line;
  if (!line) return [];
  const sorted = [...line.item.tiers].sort((a, b) => a.minQtyMilli - b.minQtyMilli);
  const appliedId = sorted.filter((tier) => line.qtyMilli >= tier.minQtyMilli).at(-1)?.id ?? null;
  return sorted.map((tier) => ({
    id: tier.id,
    text: `${fmtQtyUnit(tier.minQtyMilli, line.item.unit)} = ${fmtMoney(tier.priceCents)}`,
    active: tier.id === appliedId,
  }));
});
const basePriceActive = computed(() => !tiers.value.some((tier) => tier.active));
const basePriceText = computed(() => {
  const line = props.line;
  return line ? `${fmtMoney(line.item.priceCents)} / ${unitLabel(line.item.unit)}` : "";
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && props.open) emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (open) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
  { immediate: true },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <section
    class="t-panel-slide adjust-sheet z-20 overflow-auto bg-surface rounded-22px"
    :data-open="open && line !== null"
    :aria-hidden="!(open && line !== null)"
    :inert="!(open && line !== null)"
    aria-label="Adjust selected item"
  >
    <template v-if="line">
      <header class="flex items-center justify-between gap-12px mb-10px">
        <div class="min-w-0">
          <div class="text-12px font-800 uppercase tracking-wide text-muted">Selected item</div>
          <div class="text-20px font-900 text-ink truncate">{{ line.item.name }}</div>
        </div>
        <button
          type="button"
          class="w-44px h-44px flex-none rounded-full border-2 border-border bg-panel text-20px font-900 text-muted cursor-pointer press"
          aria-label="Close item controls"
          @click="$emit('close')"
        >✕</button>
      </header>

      <div class="adjust-sections grid gap-14px">
        <section class="adjust-section" aria-labelledby="qty-heading">
          <div class="flex items-center justify-between gap-8px mb-8px">
            <h2 id="qty-heading" class="m-0 text-14px font-900 uppercase tracking-wide text-terracotta">Quantity</h2>
            <div class="price-tiers flex items-center justify-end gap-5px min-w-0 overflow-x-auto">
              <span
                class="flex-none text-12px font-900 rounded-full px-8px py-3px border-2 whitespace-nowrap"
                :class="basePriceActive ? 'bg-oliveDark text-white border-oliveDark' : 'bg-[#ece6d8] text-muted border-borderSoft'"
              >{{ basePriceText }}</span>
              <span
                v-for="tier in tiers"
                :key="tier.id"
                class="flex-none text-12px font-900 rounded-full px-8px py-3px border-2 whitespace-nowrap"
                :class="tier.active ? 'bg-oliveDark text-white border-oliveDark' : 'bg-[#ece6d8] text-muted border-borderSoft'"
              >{{ tier.text }}</span>
            </div>
          </div>

          <div class="quantity-stepper flex items-center gap-10px">
            <button class="stepper-side adj-btn w-52px h-52px text-28px" @click="$emit('adjustQty', -0.5)">−</button>
            <div class="stepper-value-stack flex-1 min-w-0 flex flex-col items-center gap-4px">
              <button
                class="stepper-value w-full min-w-0 min-h-44px text-center font-display text-32px font-600 bg-[#f4ecdc] rounded-14px px-8px py-2px border-2 border-[#d7c9ad] cursor-pointer press"
                title="Tap to type quantity"
                @click="$emit('editQty')"
              >{{ qtyText }}</button>
              <small class="text-11px font-900 leading-none text-muted">{{ qtyUnitText }}</small>
            </div>
            <button class="stepper-side adj-btn w-52px h-52px text-28px" @click="$emit('adjustQty', 0.5)">+</button>
          </div>
          <div class="quantity-math mt-6px text-center text-14px font-800 text-terracotta truncate">{{ mathText }}</div>
          <div class="quick-grid mt-8px grid grid-cols-4 gap-7px">
            <button class="quick-button tile-dark h-44px text-16px" @click="$emit('adjustQty', -10)">− 10</button>
            <button class="quick-button tile-dark h-44px text-16px" @click="$emit('adjustQty', -1)">− 1</button>
            <button class="quick-button tile-warm h-44px text-16px" @click="$emit('adjustQty', 1)">+ 1</button>
            <button class="quick-button tile-warm h-44px text-16px" @click="$emit('adjustQty', 10)">+ 10</button>
          </div>
        </section>

        <section
          v-if="line.item.tracksTail"
          class="adjust-section pt-2px"
          aria-labelledby="tail-heading"
        >
          <h2 id="tail-heading" class="m-0 mb-8px text-14px font-900 uppercase tracking-wide text-oliveDark">Ekor</h2>
          <div class="quantity-stepper flex items-center gap-10px">
            <button class="stepper-side adj-btn w-52px h-52px text-28px" @click="$emit('adjustTail', -1)">−</button>
            <div class="stepper-value-stack flex-1 min-w-0 flex flex-col items-center gap-4px">
              <button
                class="stepper-value w-full min-w-0 min-h-44px text-center font-display text-32px font-600 bg-[#eef0e0] rounded-14px px-8px py-2px border-2 border-[#b9c49f] cursor-pointer press"
                title="Tap to type Ekor"
                @click="$emit('editTail')"
              >{{ tailText }}</button>
              <small class="text-11px font-900 leading-none text-muted">ekor</small>
            </div>
            <button class="stepper-side adj-btn w-52px h-52px text-28px" @click="$emit('adjustTail', 1)">+</button>
          </div>
          <div class="quick-grid mt-8px grid grid-cols-4 gap-7px">
            <button class="quick-button tile-dark h-44px text-16px" @click="$emit('adjustTail', -10)">− 10</button>
            <button class="quick-button tile-dark h-44px text-16px" @click="$emit('adjustTail', -1)">− 1</button>
            <button class="quick-button tile-warm h-44px text-16px" @click="$emit('adjustTail', 1)">+ 1</button>
            <button class="quick-button tile-warm h-44px text-16px" @click="$emit('adjustTail', 10)">+ 10</button>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.adjust-sheet {
  box-sizing: border-box;
  flex: 0 1 auto;
  width: 100%;
  max-height: 0;
  margin-block-start: 0;
  padding: 0 14px;
  border: 0 solid #e7dcc7;
}

.t-panel-slide {
  transform: translateY(24px);
  opacity: 0;
  filter: blur(var(--panel-blur));
  pointer-events: none;
  transition:
    max-height var(--panel-close-dur) var(--panel-ease),
    margin-block-start var(--panel-close-dur) var(--panel-ease),
    padding-block var(--panel-close-dur) var(--panel-ease),
    border-width var(--panel-close-dur) var(--panel-ease),
    transform var(--panel-close-dur) var(--panel-ease),
    opacity   var(--panel-close-dur) var(--panel-ease),
    filter    var(--panel-close-dur) var(--panel-ease);
  will-change: transform, opacity, filter;
}
.t-panel-slide[data-open="true"] {
  max-height: 420px;
  margin-block-start: 12px;
  padding-block: 14px;
  border-width: 2px;
  transform: translateY(0);
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
  transition:
    max-height var(--panel-open-dur) var(--panel-ease),
    margin-block-start var(--panel-open-dur) var(--panel-ease),
    padding-block var(--panel-open-dur) var(--panel-ease),
    border-width var(--panel-open-dur) var(--panel-ease),
    transform var(--panel-open-dur) var(--panel-ease),
    opacity   var(--panel-open-dur) var(--panel-ease),
    filter    var(--panel-open-dur) var(--panel-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-panel-slide { transition: none !important; }
}
</style>
