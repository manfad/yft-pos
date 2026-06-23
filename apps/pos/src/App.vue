<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import Toast from "./components/Toast.vue";
import { loadCompanies } from "./place";

onMounted(() => void loadCompanies());
</script>

<template>
  <div class="h-full flex flex-col bg-cream text-ink">
    <RouterView />
    <Toast />
  </div>
</template>
