<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { moneyEntry } from "../settings";

const props = defineProps<{
  open: boolean;
  title: string;
  /** Optional suffix shown next to the entered number (e.g. "kg"). */
  unit?: string;
  initial: number;
  /** Shows an "RM" label next to the entered value when no unit is given. */
  money?: boolean;
}>();

const unitText = computed(() => props.unit ?? "");
const emit = defineEmits<{ confirm: [value: number]; close: [] }>();

const entry = ref("");
// `replace` makes the first keypress overwrite the seeded value (like a till).
const replace = ref(true);
// Shifted entry: `entry` holds hundredths and every digit shifts the amount
// left (3,0,0 → 3.00), so there is no "." to press. Money numpads follow the
// money-entry setting; kg numpads always enter this way (other units never do).
// Snapshotted on open so `entry` keeps one format for the whole session.
const cents = ref(false);
// Room for RM 999,999.99 — beyond that a digit is a mis-tap, not an amount.
const MAX_CENT_DIGITS = 8;

const display = computed(() =>
  cents.value ? ((Number(entry.value) || 0) / 100).toFixed(2) : entry.value || "0",
);

watch(
  () => props.open,
  (o) => {
    if (o) {
      cents.value = (props.money === true && moneyEntry.value === "cents") || props.unit === "kg";
      entry.value = props.initial
        ? String(cents.value ? Math.round(props.initial * 100) : props.initial)
        : "";
      replace.value = true;
    }
  },
);

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];

function tap(k: string): void {
  if (k === "⌫") {
    entry.value = entry.value.slice(0, -1);
    return;
  }
  if (k === "." && cents.value) return;
  if (replace.value) {
    entry.value = "";
    replace.value = false;
  }
  if (k === ".") {
    if (entry.value.includes(".")) return;
    if (entry.value === "") entry.value = "0";
  }
  if (cents.value) {
    if (entry.value.length >= MAX_CENT_DIGITS) return;
    entry.value = (entry.value + k).replace(/^0+(?=\d)/, "");
    return;
  }
  entry.value += k;
}

function clearAll(): void {
  entry.value = "";
  replace.value = false;
}

function ok(): void {
  const n = Number(entry.value) || 0;
  emit("confirm", cents.value ? n / 100 : n);
}

// Hardware keyboard / USB numpad support: digits and "." type (the "." being
// ignored in cents-first mode, as on the keypad), Backspace deletes, Enter
// confirms, Escape cancels.
function onKeydown(e: KeyboardEvent): void {
  if (/^[0-9.]$/.test(e.key)) tap(e.key);
  else if (e.key === "Backspace") tap("⌫");
  else if (e.key === "Enter") ok();
  else if (e.key === "Escape") emit("close");
  else return;
  e.preventDefault();
}
watch(
  () => props.open,
  (o) => {
    if (o) window.addEventListener("keydown", onKeydown);
    else window.removeEventListener("keydown", onKeydown);
  },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div
      class="w-420px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col"
      style="max-height: 95vh"
    >
      <!-- header + display -->
      <div class="px-24px pt-22px pb-18px border-b-2 border-borderSoft flex-none">
        <div class="text-15px font-800 text-muted uppercase tracking-wider">{{ title }}</div>
        <div class="mt-8px flex items-baseline justify-end gap-10px bg-[#f4ecdc] rounded-16px px-20px py-14px min-h-72px">
          <span v-if="money && !unit" class="mr-auto text-22px font-800 text-muted">RM</span>
          <span class="font-display text-52px font-700 text-ink leading-none">{{ display }}</span>
          <span class="text-22px font-800 text-muted">{{ unitText }}</span>
        </div>
      </div>

      <!-- keypad -->
      <div class="p-20px grid grid-cols-3 gap-12px overflow-auto flex-1 min-h-0">
        <!-- "." keeps its cell (blank and inert) in cents-first mode so the 3-column grid holds. -->
        <button
          v-for="k in KEYS"
          :key="k"
          class="h-64px rounded-16px border-2 text-28px font-800"
          :class="
            k === '.' && cents
              ? 'border-transparent bg-transparent text-transparent cursor-default'
              : k === '⌫'
                ? 'border-[#d94b3d] bg-[#d94b3d] text-white cursor-pointer press'
                : 'border-border bg-tile text-ink cursor-pointer press'
          "
          :disabled="k === '.' && cents"
          @click="tap(k)"
        >{{ k }}</button>
      </div>

      <!-- actions (pinned, always visible) -->
      <div class="px-20px py-20px grid grid-cols-3 gap-12px flex-none border-t-2 border-borderSoft bg-surface rounded-b-26px">
        <button
          class="h-64px rounded-16px border-2 border-[#e0a92e] bg-[#f5c542] text-18px font-800 text-ink cursor-pointer press"
          @click="clearAll"
        >Clear</button>
        <button
          class="h-64px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer press"
          @click="$emit('close')"
        >Cancel</button>
        <button class="btn-pay h-64px text-22px" @click="ok">OK</button>
      </div>
    </div>
  </div>
</template>
