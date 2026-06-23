<script setup lang="ts">
const props = defineProps<{ modelValue: number }>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

function onInput(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  emit("update:modelValue", Number.isFinite(v) && v >= 0 ? v : 0);
}
</script>

<template>
  <div
    class="flex items-center gap-6px h-44px px-12px rounded-10px border-2 border-border bg-white focus-within:border-olive"
  >
    <span class="text-16px font-800 text-muted flex-none">RM</span>
    <input
      :value="props.modelValue"
      type="number"
      step="0.01"
      min="0"
      inputmode="decimal"
      class="flex-1 min-w-0 p-0 text-16px text-ink bg-transparent outline-none border-none"
      @input="onInput"
    />
  </div>
</template>
