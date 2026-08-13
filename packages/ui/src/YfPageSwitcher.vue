<script setup lang="ts">
export interface PageSwitchOption { value: string; label: string }
defineProps<{ modelValue: string; options: PageSwitchOption[] }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <div class="inline-flex items-center gap-6px p-5px rounded-18px border-2 border-border bg-panel" role="group" aria-label="Page switcher">
    <button v-for="option in options" :key="option.value" class="yf-focus press min-h-48px px-18px rounded-13px border-0 text-16px font-900 cursor-pointer" :class="modelValue === option.value ? 'bg-ink text-white shadow-[0_2px_0_rgba(44,38,32,.2)]' : 'bg-transparent text-muted'" :aria-pressed="modelValue === option.value" @click="$emit('update:modelValue', option.value)">{{ option.label }}</button>
  </div>
</template>
