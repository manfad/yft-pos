<script setup lang="ts">
import { computed, ref } from "vue";
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
    /** Fixed decimal places for the displayed value (e.g. 2 for money). */
    decimals?: number;
  }>(),
  { title: "Enter value" },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

// Two root nodes (field + dialog) disable automatic attr fallthrough, so a
// caller's class (e.g. a fixed width) must be forwarded to the field explicitly.
defineOptions({ inheritAttrs: false });

const open = ref(false);
// `decimals: 2` is only ever used for RM amounts; the numpad shows an RM
// label for those.
const money = computed(() => props.decimals === 2);
function onConfirm(v: number): void {
  emit("update:modelValue", v);
  open.value = false;
}
</script>

<template>
  <button
    v-bind="$attrs"
    type="button"
    class="inline-flex items-center justify-center gap-6px rounded-12px border-2 border-border bg-white text-ink cursor-pointer press hover:border-olive outline-none focus:outline-none"
    :class="big ? 'h-56px min-w-130px px-16px text-22px' : 'h-44px min-w-0 px-12px text-16px'"
    @click="open = true"
  >
    <span v-if="prefix" class="font-700 text-muted">{{ prefix }}</span>
    <span class="font-900">{{ decimals != null ? modelValue.toFixed(decimals) : modelValue }}</span>
    <span v-if="suffix" class="font-700 text-muted">{{ suffix }}</span>
  </button>

  <NumpadDialog
    :open="open"
    :title="title"
    :unit="unit"
    :money="money"
    :initial="modelValue"
    @confirm="onConfirm"
    @close="open = false"
  />
</template>
