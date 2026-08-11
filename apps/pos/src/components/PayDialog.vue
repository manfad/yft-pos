<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { fmtMoney, PAYMENT_METHODS, toRM, type PaymentMethod } from "@yf/core";
import { PAYMENT_UI } from "../payments";
import { useCentsEntry } from "../centsEntry";

const props = defineProps<{ open: boolean; totalCents: number }>();
// "Credit" is special: it opens the creditor picker rather than settling here.
const emit = defineEmits<{ confirm: [method: PaymentMethod]; credit: []; close: [] }>();

// The dialog is either the method list or the cash calculator. The calculator
// is a cashier's scratch pad: nothing it computes is stored with the sale.
const view = ref<"methods" | "calc">("methods");
const received = useCentsEntry();
const receivedText = received.text;
const changeCents = computed(() => received.cents.value - props.totalCents);
const short = computed(() => changeCents.value < 0);
const amount = (cents: number): string => toRM(cents).toFixed(2);

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "00", "0", "⌫"];

function openCalc(): void {
  received.reset();
  view.value = "calc";
}

function tap(k: string): void {
  if (k === "⌫") received.backspace();
  else received.push(k);
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      view.value = "methods";
      received.reset();
    }
  },
);

// Hardware keyboard / USB numpad, same as the quantity numpad: digits type,
// Backspace deletes, Enter pays, Escape steps back to the method list.
function onKeydown(e: KeyboardEvent): void {
  if (/^[0-9]$/.test(e.key)) tap(e.key);
  else if (e.key === "Backspace") tap("⌫");
  else if (e.key === "Enter") emit("confirm", "Cash");
  else if (e.key === "Escape") view.value = "methods";
  else return;
  e.preventDefault();
}
watch(
  () => props.open && view.value === "calc",
  (active) => {
    if (active) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-80"
    @click.self="$emit('close')"
  >
    <div
      class="w-560px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] overflow-hidden flex flex-col"
      style="max-height: 95vh"
    >
      <!-- method list -->
      <template v-if="view === 'methods'">
        <div class="px-28px py-26px text-center border-b-2 border-borderSoft">
          <div class="text-17px font-800 text-muted uppercase tracking-wider">Amount to pay</div>
          <div class="font-display text-58px font-700 text-terracotta leading-tight">{{ fmtMoney(totalCents) }}</div>
        </div>
        <div class="px-28px py-24px flex flex-col gap-14px">
          <div class="text-18px font-800 text-center mb-2px">Choose payment method</div>
          <div v-for="m in PAYMENT_METHODS" :key="m" class="flex gap-12px">
            <button
              class="flex-1 min-w-0 flex items-center gap-18px px-24px py-18px rounded-18px border-2 border-border bg-tile cursor-pointer text-left transition-transform active:translate-y-2px"
              @click="m === 'Credit' ? $emit('credit') : $emit('confirm', m)"
            >
              <span
                class="w-60px h-60px flex-none rounded-16px flex items-center justify-center text-30px"
                :style="{ background: PAYMENT_UI[m].tint }"
              >{{ PAYMENT_UI[m].icon }}</span>
              <span class="text-25px font-800 text-ink uppercase">{{ m }}</span>
              <span v-if="m === 'Credit'" class="ml-auto text-15px font-800 text-muted">pay later ›</span>
            </button>
            <!-- change calculator: scratch pad only, never settles the sale -->
            <button
              v-if="m === 'Cash'"
              class="w-96px flex-none flex flex-col items-center justify-center gap-4px rounded-18px border-2 border-olive bg-white text-olive cursor-pointer press"
              aria-label="Cash change calculator"
              @click="openCalc"
            >
              <svg viewBox="0 0 24 24" class="w-26px h-26px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="4" y="2.5" width="16" height="19" rx="3" />
                <path d="M7.5 7h9" />
                <path d="M8.5 12h0M12 12h0M15.5 12h0M8.5 16.5h0M12 16.5h0M15.5 16.5h0" stroke-width="2.6" />
              </svg>
              <span class="text-13px font-800 uppercase tracking-wide">Change</span>
            </button>
          </div>
        </div>
        <div class="px-28px pb-26px">
          <button
            class="w-full h-56px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer"
            @click="$emit('close')"
          >Cancel</button>
        </div>
      </template>

      <!-- cash calculator -->
      <template v-else>
        <div class="px-20px pt-18px pb-16px border-b-2 border-borderSoft flex-none">
          <div class="flex items-center gap-12px">
            <button
              class="h-44px px-16px rounded-14px border-2 border-border bg-white text-16px font-800 text-muted cursor-pointer press"
              @click="view = 'methods'"
            >‹ Back</button>
            <span class="text-15px font-800 text-muted uppercase tracking-wider">Cash change</span>
          </div>

          <div class="mt-12px bg-[#f4ecdc] rounded-16px px-20px py-14px">
            <div class="flex items-baseline justify-between">
              <span class="text-16px font-800 text-muted uppercase tracking-wide">Received</span>
              <span class="font-display text-42px font-700 text-ink leading-none">{{ receivedText }}</span>
            </div>
            <div class="mt-8px flex items-baseline justify-between">
              <span class="text-16px font-800 text-muted uppercase tracking-wide">− Total</span>
              <span class="font-display text-26px font-700 text-muted leading-none">{{ amount(totalCents) }}</span>
            </div>
            <div class="my-10px border-t-2 border-warmBorder"></div>
            <div class="flex items-baseline justify-between">
              <span
                class="text-16px font-800 uppercase tracking-wide"
                :class="short ? 'text-[#d94b3d]' : 'text-muted'"
              >{{ short ? "Short" : "Change" }}</span>
              <span
                class="font-display text-46px font-700 leading-none"
                :class="short ? 'text-[#d94b3d]' : 'text-olive'"
              >{{ short ? "−" : "" }}{{ amount(Math.abs(changeCents)) }}</span>
            </div>
          </div>
        </div>

        <div class="p-16px grid grid-cols-3 gap-12px overflow-auto flex-1 min-h-0">
          <button
            v-for="k in KEYS"
            :key="k"
            class="h-60px rounded-16px border-2 text-28px font-800 cursor-pointer press"
            :class="k === '⌫' ? 'border-[#d94b3d] bg-[#d94b3d] text-white' : 'border-border bg-tile text-ink'"
            @click="tap(k)"
          >{{ k }}</button>
        </div>

        <div class="px-16px pb-20px flex-none">
          <button class="btn-pay w-full h-68px text-26px" @click="$emit('confirm', 'Cash')">PAY CASH</button>
        </div>
      </template>
    </div>
  </div>
</template>
