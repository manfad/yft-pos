<script setup lang="ts">
import YfDialog from "./YfDialog.vue";

withDefaults(defineProps<{ open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; layer?: number }>(), {
  confirmLabel: "Confirm", danger: false, layer: 110
});
defineEmits<{ confirm: []; close: [] }>();
</script>

<template>
  <YfDialog :open="open" :title="title" width="520px" :layer="layer" @close="$emit('close')">
    <p class="m-0 p-28px text-19px leading-7 font-700 text-muted">{{ message }}</p>
    <template #footer>
      <div class="flex justify-end gap-12px">
        <button class="yf-btn" @click="$emit('close')">Go back</button>
        <button :class="danger ? 'yf-btn-danger' : 'yf-btn-primary'" @click="$emit('confirm')">{{ confirmLabel }}</button>
      </div>
    </template>
  </YfDialog>
</template>
