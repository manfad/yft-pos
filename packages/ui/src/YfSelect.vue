<script setup lang="ts">
export interface SelectOption { value: string; label: string }
const model = defineModel<string>({ required: true });
withDefaults(defineProps<{ label: string; options: SelectOption[]; disabled?: boolean }>(), { disabled: false });
</script>

<template>
  <label class="block">
    <span class="block mb-7px text-13px font-900 text-muted uppercase">{{ label }}</span>
    <select v-model="model" class="yf-input pr-46px" :disabled="disabled">
      <option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>
  </label>
</template>
