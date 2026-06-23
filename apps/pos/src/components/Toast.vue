<script setup lang="ts">
import { useUi } from "../stores/ui";
const ui = useUi();
</script>

<template>
  <div
    v-if="ui.toast"
    class="fixed left-1/2 bottom-34px -translate-x-1/2 bg-olive text-white px-32px py-16px rounded-16px font-display text-23px font-600 shadow-[0_10px_28px_rgba(0,0,0,.22)] z-60"
    style="animation: toastIn 0.25s ease"
  >
    ✓ {{ ui.toast }}
  </div>
</template>
