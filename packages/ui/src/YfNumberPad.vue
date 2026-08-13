<script setup lang="ts">
import { computed, onUnmounted, shallowRef, watch } from "vue";
import YfDialog from "./YfDialog.vue";

const props = withDefaults(defineProps<{ open: boolean; title: string; initial?: number; money?: boolean; unit?: string; layer?: number }>(), {
  initial: 0, money: false, unit: "", layer: 120
});
const emit = defineEmits<{ confirm: [value: number]; close: [] }>();
const entry = shallowRef("");
const replace = shallowRef(true);
const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];
const display = computed(() => entry.value || "0");

watch(() => props.open, (open) => {
  if (open) { entry.value = props.initial ? String(props.initial) : ""; replace.value = true; window.addEventListener("keydown", onKeydown); }
  else window.removeEventListener("keydown", onKeydown);
});
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function tap(key: string): void {
  if (key === "⌫") { entry.value = entry.value.slice(0, -1); replace.value = false; return; }
  if (replace.value) { entry.value = ""; replace.value = false; }
  if (key === "." && entry.value.includes(".")) return;
  if (key === "." && !entry.value) entry.value = "0";
  entry.value += key;
}
function submit(): void { emit("confirm", Number(entry.value) || 0); }
function onKeydown(event: KeyboardEvent): void {
  if (/^[0-9.]$/.test(event.key)) tap(event.key);
  else if (event.key === "Backspace") tap("⌫");
  else if (event.key === "Enter") submit();
  else return;
  event.preventDefault();
}
</script>

<template>
  <YfDialog :open="open" :title="title" width="430px" :layer="layer" @close="$emit('close')">
    <div class="p-22px">
      <div class="flex items-baseline gap-10px px-18px py-14px mb-18px bg-warm rounded-16px min-h-74px">
        <span v-if="money" class="text-22px font-900 text-muted">RM</span>
        <output class="ml-auto font-display text-50px font-700 text-ink">{{ display }}</output>
        <span v-if="unit" class="text-20px font-900 text-muted">{{ unit }}</span>
      </div>
      <div class="grid grid-cols-3 gap-12px">
        <button v-for="key in keys" :key="key" class="yf-btn h-66px px-0 text-27px" :class="key === '⌫' ? 'text-danger border-danger' : ''" @click="tap(key)">{{ key }}</button>
      </div>
    </div>
    <template #footer>
      <div class="grid grid-cols-3 gap-12px">
        <button class="yf-btn" @click="entry = ''; replace = false">Clear</button>
        <button class="yf-btn" @click="$emit('close')">Cancel</button>
        <button class="yf-btn-primary" @click="submit">OK</button>
      </div>
    </template>
  </YfDialog>
</template>
