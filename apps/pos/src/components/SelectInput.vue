<script setup lang="ts" generic="T extends string | number | null">
import { computed, ref } from "vue";

const props = defineProps<{
  modelValue: T;
  options: Array<{ value: T; label: string }>;
  placeholder?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: T] }>();

const open = ref(false);
const selected = computed(() => props.options.find((o) => o.value === props.modelValue));
const display = computed(() => selected.value?.label ?? props.placeholder ?? "Select");

function pick(o: { value: T; label: string }): void {
  emit("update:modelValue", o.value);
  open.value = false;
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="press w-full flex items-center justify-between gap-8px h-44px px-12px rounded-10px border-2 border-border bg-white text-16px font-700 text-ink cursor-pointer"
      @click="open = !open"
    >
      <span class="truncate">{{ display }}</span>
      <span class="text-13px text-muted flex-none" :class="open ? 'rotate-180' : ''">▾</span>
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div
        class="absolute top-full left-0 mt-4px z-50 min-w-full max-h-260px overflow-auto bg-surface border-2 border-border rounded-12px shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-4px"
      >
        <button
          v-for="o in options"
          :key="String(o.value)"
          type="button"
          class="press w-full flex items-center justify-between gap-10px text-left px-12px py-9px rounded-9px text-16px font-700 cursor-pointer border-none whitespace-nowrap"
          :class="o.value === modelValue ? 'bg-olive text-white' : 'bg-transparent text-muted hover:bg-panel'"
          @click="pick(o)"
        >
          <span class="truncate">{{ o.label }}</span>
          <span v-if="o.value === modelValue" class="flex-none text-13px font-900">✓</span>
        </button>
      </div>
    </template>
  </div>
</template>
