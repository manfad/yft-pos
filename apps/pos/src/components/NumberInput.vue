<script setup lang="ts">
import { ref } from "vue";
import NumpadDialog from "./NumpadDialog.vue";

// Touchscreen number field: looks like an input but opens the on-screen numpad
// on tap (no OS keyboard). Two-way bound via v-model.
const props = withDefaults(
  defineProps<{
    modelValue: number;
    /** Heading shown in the numpad dialog. */
    title?: string;
    /** Suffix shown inside the numpad (e.g. "kg"). */
    unit?: string;
    /** Small label before the value on the field (e.g. "RM"). */
    prefix?: string;
    /** Small label after the value on the field (e.g. "/ kg"). */
    suffix?: string;
    /** Larger, bolder field. */
    big?: boolean;
  }>(),
  { title: "Enter value" },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const open = ref(false);
function onConfirm(v: number): void {
  emit("update:modelValue", v);
  open.value = false;
}
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center justify-center gap-6px rounded-12px border-2 border-border bg-white text-ink cursor-pointer press hover:border-olive"
    :class="big ? 'h-56px min-w-130px px-16px text-22px' : 'h-44px min-w-92px px-12px text-16px'"
    @click="open = true"
  >
    <span v-if="prefix" class="font-700 text-muted">{{ prefix }}</span>
    <span class="font-900">{{ modelValue }}</span>
    <span v-if="suffix" class="font-700 text-muted">{{ suffix }}</span>
  </button>

  <NumpadDialog
    :open="open"
    :title="title"
    :unit="unit"
    :initial="modelValue"
    @confirm="onConfirm"
    @close="open = false"
  />
</template>
