<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import { useRestaurantStore } from "./stores/restaurant";

const store = useRestaurantStore();
onMounted(() => void store.hydrate());
</script>

<template>
  <div class="h-full flex flex-col bg-cream text-ink">
    <AppHeader />
    <main class="flex-1 min-h-0" aria-label="Restaurant workspace">
      <div v-if="!store.ready" class="h-full grid place-items-center text-24px font-900 text-muted">Opening restaurant…</div>
      <RouterView v-else />
    </main>
  </div>
</template>
