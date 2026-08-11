<script setup lang="ts">
import { computed, ref, watch } from "vue";

// On-screen QWERTY for touchscreen terminals (no physical keyboard).
const props = defineProps<{ open: boolean; title: string; initial: string }>();
const emit = defineEmits<{ confirm: [value: string]; close: [] }>();

const entry = ref("");
const caps = ref(false);
const layer = ref<"letters" | "symbols">("letters");

watch(
  () => props.open,
  (o) => {
    if (o) {
      entry.value = props.initial ?? "";
      caps.value = false;
      layer.value = "letters";
    }
  },
);

const LETTER_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];
const SYMBOL_ROWS = [
  ["(", ")", "[", "]", "{", "}", "<", ">"],
  ["!", "@", "#", "$", "%", "&", "*", "+", "="],
  ["-", "_", "/", ":", ";", ",", ".", "'", "\"", "?"],
];
const rows = computed(() => (layer.value === "letters" ? LETTER_ROWS : SYMBOL_ROWS));

function tap(k: string): void {
  entry.value += layer.value === "letters" && caps.value ? k.toUpperCase() : k;
}
function backspace(): void {
  entry.value = entry.value.slice(0, -1);
}
function ok(): void {
  emit("confirm", entry.value.trim());
}

// Stagger the home (asdf) and bottom (zxcv) rows like a physical keyboard.
function rowIndent(ri: number): string {
  if (ri === 2) return "32px";
  if (ri === 3) return "64px";
  return "0";
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div
      class="w-760px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col"
      style="max-height: 95vh"
    >
      <!-- header + display -->
      <div class="px-24px pt-22px pb-18px border-b-2 border-borderSoft flex-none">
        <div class="text-15px font-800 text-muted uppercase tracking-wider">{{ title }}</div>
        <div class="mt-8px flex items-center bg-[#f4ecdc] rounded-16px px-20px py-14px min-h-66px">
          <span class="font-display text-30px font-700 text-ink break-all leading-tight">{{ entry }}</span>
          <span class="w-2px h-32px bg-ink/40 ml-2px animate-pulse" />
        </div>
      </div>

      <!-- keys (fixed-width, staggered like a physical keyboard) -->
      <div class="p-16px overflow-auto flex-1 min-h-0">
        <div class="mx-auto flex flex-col gap-10px w-632px max-w-full">
          <div
            v-for="(row, ri) in rows"
            :key="`${layer}-${ri}`"
            class="flex gap-8px"
            :class="layer === 'symbols' ? 'justify-center' : ''"
            :style="{ marginLeft: layer === 'letters' ? rowIndent(ri) : '0' }"
          >
            <button
              v-for="k in row"
              :key="k"
              class="flex-none w-56px h-52px rounded-12px border-2 border-border bg-tile text-24px font-800 text-ink cursor-pointer press"
              @click="tap(k)"
            >{{ caps && layer === 'letters' ? k.toUpperCase() : k }}</button>
          </div>

          <!-- bottom row: layer toggle, shift, space, backspace -->
          <div class="flex gap-8px w-full">
            <button
              class="w-120px h-52px rounded-12px border-2 border-border bg-tile text-20px font-800 text-ink cursor-pointer press"
              @click="layer = layer === 'letters' ? 'symbols' : 'letters'"
            >{{ layer === "letters" ? "?#$" : "ABC" }}</button>
            <button
              v-if="layer === 'letters'"
              class="w-120px h-52px rounded-12px border-2 text-20px font-800 cursor-pointer press"
              :class="caps ? 'bg-ink text-white border-ink' : 'bg-tile text-ink border-border'"
              @click="caps = !caps"
            >⇧ Caps</button>
            <button
              class="flex-1 h-52px rounded-12px border-2 border-border bg-tile text-20px font-800 text-ink cursor-pointer press"
              @click="entry += ' '"
            >space</button>
            <button
              class="w-120px h-52px rounded-12px border-2 border-[#d94b3d] bg-[#d94b3d] text-24px font-800 text-white cursor-pointer press"
              @click="backspace"
            >⌫</button>
          </div>
        </div>
      </div>

      <!-- actions (pinned, always visible) -->
      <div class="px-16px py-16px grid grid-cols-3 gap-12px flex-none border-t-2 border-borderSoft bg-surface rounded-b-26px">
        <button
          class="h-56px rounded-16px border-2 border-[#e0a92e] bg-[#f5c542] text-18px font-800 text-ink cursor-pointer press"
          @click="entry = ''"
        >Clear</button>
        <button
          class="h-56px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer press"
          @click="$emit('close')"
        >Cancel</button>
        <button class="btn-pay h-56px text-22px" @click="ok">OK</button>
      </div>
    </div>
  </div>
</template>
