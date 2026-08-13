<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
defineProps<{ label: string; description?: string }>();
</script>

<template>
  <label class="flex items-center justify-between gap-16px min-h-62px cursor-pointer">
    <span><strong class="block text-17px">{{ label }}</strong><small v-if="description" class="block mt-2px text-13px font-700 text-muted">{{ description }}</small></span>
    <input v-model="model" type="checkbox" class="switch-input sr-only" />
    <span class="switch-track relative flex-none w-68px h-38px rounded-full bg-[#d8cfbc] transition-colors" aria-hidden="true"><span class="switch-thumb absolute top-4px left-4px w-30px h-30px rounded-full bg-white shadow-[0_2px_5px_rgba(44,38,32,.25)] transition-transform" /></span>
  </label>
</template>

<style scoped>
.switch-input:checked + .switch-track { background: #6e8a4e; }
.switch-input:checked + .switch-track .switch-thumb { transform: translateX(30px); }
.switch-input:focus-visible + .switch-track { outline: 3px solid #6e8a4e; outline-offset: 3px; }
</style>
