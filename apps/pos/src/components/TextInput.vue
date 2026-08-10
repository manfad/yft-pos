<script setup lang="ts">
import { shallowRef, useAttrs } from "vue";
import KeyboardDialog from "./KeyboardDialog.vue";

defineOptions({ inheritAttrs: false });

// Touchscreen text field: looks like an input but opens the on-screen QWERTY
// keyboard on tap (no OS keyboard). Two-way bound via v-model.
const props = defineProps<{ modelValue: string; placeholder?: string; title?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const attrs = useAttrs();
const open = shallowRef(false);
function onConfirm(v: string): void {
  emit("update:modelValue", v);
  open.value = false;
}
</script>

<template>
  <button
    v-bind="attrs"
    type="button"
    class="min-w-0 h-44px px-12px rounded-10px border-2 border-border bg-white text-16px text-left cursor-pointer press hover:border-olive flex items-center"
    @click="open = true"
  >
    <span v-if="modelValue" class="text-ink truncate">{{ modelValue }}</span>
    <span v-else class="text-faint truncate">{{ placeholder }}</span>
  </button>

  <KeyboardDialog
    :open="open"
    :title="title ?? placeholder ?? 'Enter text'"
    :initial="modelValue"
    @confirm="onConfirm"
    @close="open = false"
  />
</template>
