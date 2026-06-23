<script setup lang="ts">
defineProps<{ modelValue: string; placeholder?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <input
    :value="modelValue"
    :placeholder="placeholder"
    class="h-44px px-12px rounded-10px border-2 border-border bg-white text-16px text-ink outline-none focus:border-olive"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
