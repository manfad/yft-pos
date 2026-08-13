<script setup lang="ts">
import { computed } from "vue";

export interface PageCycleOption { value: string; label: string }
const props = defineProps<{ modelValue: string; options: PageCycleOption[] }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const index = computed(() => Math.max(0, props.options.findIndex((option) => option.value === props.modelValue)));
const current = computed(() => props.options[index.value]);
const next = computed(() => props.options[(index.value + 1) % props.options.length]);
function advance(): void { if (next.value) emit("update:modelValue", next.value.value); }
</script>

<template>
  <button
    class="yf-focus press inline-flex items-center gap-14px min-h-58px pl-20px pr-16px rounded-18px border-2 border-border bg-panel cursor-pointer"
    :aria-label="`Page: ${current?.label}. Press for ${next?.label}`"
    @click="advance"
  >
    <span class="relative block min-w-160px h-30px overflow-hidden text-left">
      <Transition name="cycle">
        <strong :key="current?.value" class="absolute inset-0 flex items-center font-display text-23px font-700 text-ink whitespace-nowrap">{{ current?.label }}</strong>
      </Transition>
    </span>
    <span class="flex items-center gap-5px" aria-hidden="true">
      <span v-for="(option, spot) in options" :key="option.value" class="h-8px rounded-full transition-all duration-200" :class="spot === index ? 'bg-ink' : 'bg-faint'" :style="{ width: spot === index ? '20px' : '8px' }" />
    </span>
  </button>
</template>

<style scoped>
.cycle-enter-active, .cycle-leave-active { transition: transform 220ms cubic-bezier(.2, .8, .3, 1), opacity 160ms ease; }
.cycle-enter-from { transform: translateY(100%); opacity: 0; }
.cycle-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
