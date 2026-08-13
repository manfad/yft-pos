<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { fmtMoney, PAYMENT_METHODS, toCents, toRM, type PaymentMethod } from "@yf/core";
import { PAYMENT_UI } from "../payments";
import { moneyEntry } from "../settings";

const props = defineProps<{ open: boolean; totalCents: number }>();
// "Credit" is special: it opens the creditor picker rather than settling here.
const emit = defineEmits<{ confirm: [method: PaymentMethod]; credit: []; close: [] }>();

// The dialog is either the method list or the cash calculator. The calculator
// is a cashier's scratch pad: nothing it computes is stored with the sale.
const view = ref<"methods" | "calc">("methods");
const receivedEntry = ref("");
// Cents-first entry (the money-entry setting): `receivedEntry` holds cents and
// every digit shifts the amount left (3,0,0 → 3.00), so there is no "." to
// press. Snapshotted when the calculator opens so one session keeps one format.
const cents = ref(false);
// Room for RM 999,999.99 — beyond that a digit is a mis-tap, not an amount.
const MAX_CENT_DIGITS = 8;
const receivedText = computed(() =>
  cents.value ? ((Number(receivedEntry.value) || 0) / 100).toFixed(2) : receivedEntry.value || "0",
);
const receivedCents = computed(() =>
  cents.value ? Number(receivedEntry.value) || 0 : toCents(Number(receivedEntry.value) || 0),
);
const changeCents = computed(() => receivedCents.value - props.totalCents);
const short = computed(() => changeCents.value < 0);
const amount = (cents: number): string => toRM(cents).toFixed(2);

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

function openCalc(): void {
  cents.value = moneyEntry.value === "cents";
  receivedEntry.value = "";
  view.value = "calc";
}

function tap(k: string): void {
  if (k === "⌫") {
    receivedEntry.value = receivedEntry.value.slice(0, -1);
    return;
  }
  if (k === "." && cents.value) return;
  if (k === ".") {
    if (receivedEntry.value.includes(".")) return;
    if (receivedEntry.value === "") receivedEntry.value = "0";
  }
  if (cents.value) {
    if (receivedEntry.value.length >= MAX_CENT_DIGITS) return;
    receivedEntry.value = (receivedEntry.value + k).replace(/^0+(?=\d)/, "");
    return;
  }
  receivedEntry.value += k;
}

watch(
  () => props.open,
  (o) => {
    if (o) {
      view.value = "methods";
      receivedEntry.value = "";
    }
  },
);

// Hardware keyboard / USB numpad, same as the quantity numpad: digits and "."
// type, Backspace deletes, Enter pays, Escape steps back to the method list.
function onKeydown(e: KeyboardEvent): void {
  if (/^[0-9.]$/.test(e.key)) tap(e.key);
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
              class="w-96px flex-none flex flex-col items-center justify-center gap-4px rounded-18px border-2 border-border bg-tile cursor-pointer transition-transform active:translate-y-2px"
              aria-label="Cash change calculator"
              @click="openCalc"
            >
              <!-- color SVG: the calculator emoji has no color glyph on some platforms -->
              <span
                class="w-40px h-40px flex-none rounded-12px flex items-center justify-center"
                :style="{ background: PAYMENT_UI.Cash.tint }"
              >
                <svg viewBox="0 0 24 24" class="w-24px h-24px" aria-hidden="true">
                  <rect x="4" y="2" width="16" height="20" rx="3" fill="#5b6d3f" />
                  <rect x="6.2" y="4.4" width="11.6" height="4.6" rx="1.2" fill="#d8e6c4" />
                  <g fill="#f6f1e4">
                    <rect x="6.2" y="11" width="3" height="2.6" rx="0.8" />
                    <rect x="10.5" y="11" width="3" height="2.6" rx="0.8" />
                    <rect x="6.2" y="15" width="3" height="2.6" rx="0.8" />
                    <rect x="10.5" y="15" width="3" height="2.6" rx="0.8" />
                    <rect x="6.2" y="19" width="7.3" height="1.4" rx="0.7" />
                  </g>
                  <rect x="14.8" y="11" width="3" height="2.6" rx="0.8" fill="#e8a13c" />
                  <rect x="14.8" y="15" width="3" height="5.4" rx="0.8" fill="#e8a13c" />
                </svg>
              </span>
              <span class="text-13px font-800 uppercase tracking-wide text-ink">Change</span>
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
