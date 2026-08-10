<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import { getPin } from "../settings";

// Big-button PIN gate for the few consequential actions (void a sale, reopen
// the day, change settings). One trusted cashier — this is a "are you sure /
// are you authorized" check, not a user system.

const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ ok: []; close: [] }>();

const entry = ref("");
const error = ref(false);

watch(
  () => props.open,
  (o) => {
    if (o) {
      entry.value = "";
      error.value = false;
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
    }
  },
);
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "", "0", "⌫"];

function tap(k: string): void {
  if (!k) return;
  error.value = false;
  if (k === "⌫") entry.value = entry.value.slice(0, -1);
  else if (entry.value.length < 8) entry.value += k;
}

async function ok(): Promise<void> {
  if ((await getPin()) === entry.value) {
    emit("ok");
  } else {
    error.value = true;
    entry.value = "";
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (/^[0-9]$/.test(e.key)) tap(e.key);
  else if (e.key === "Backspace") tap("⌫");
  else if (e.key === "Enter") void ok();
  else if (e.key === "Escape") emit("close");
  else return;
  e.preventDefault();
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-95"
    @click.self="$emit('close')"
  >
    <div class="w-380px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col" style="max-height: 95vh">
      <div class="px-24px pt-22px pb-18px border-b-2 border-borderSoft flex-none">
        <div class="text-15px font-800 text-muted uppercase tracking-wider">{{ title }}</div>
        <div class="mt-8px flex items-center justify-center bg-[#f4ecdc] rounded-16px px-20px py-14px min-h-64px">
          <span class="font-display text-40px font-700 tracking-[0.4em] leading-none" :class="error ? 'text-[#d94b3d]' : 'text-ink'">
            {{ entry ? "•".repeat(entry.length) : "PIN" }}
          </span>
        </div>
        <div v-if="error" class="mt-8px text-center text-15px font-800 text-[#d94b3d]">Wrong PIN — try again</div>
      </div>

      <div class="p-20px grid grid-cols-3 gap-12px flex-1 min-h-0">
        <button
          v-for="(k, i) in KEYS"
          :key="i"
          class="h-60px rounded-16px border-2 text-26px font-800 cursor-pointer press"
          :class="k ? 'border-border bg-tile text-ink' : 'border-transparent bg-transparent cursor-default'"
          @click="tap(k)"
        >{{ k }}</button>
      </div>

      <div class="px-20px py-20px grid grid-cols-2 gap-12px flex-none border-t-2 border-borderSoft">
        <button
          class="h-60px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer press"
          @click="$emit('close')"
        >Cancel</button>
        <button class="btn-pay h-60px text-20px" @click="ok">OK</button>
      </div>
    </div>
  </div>
</template>
