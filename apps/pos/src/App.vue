<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import Toast from "./components/Toast.vue";
import { loadCompanies } from "./place";
import { loadUserImages } from "./productImage";
import { autoCloseUnclosedDays } from "./business";
import { loadMoneyEntry } from "./settings";
import { useUi } from "./stores/ui";

const ui = useUi();

onMounted(() => {
  void loadCompanies();
  void loadUserImages();
  void loadMoneyEntry();
  // Forgot-to-close fallback: close past days automatically and email HQ.
  void autoCloseUnclosedDays()
    .then((dates) => {
      if (dates.length === 1) ui.showToast(`Closed ${dates[0]} automatically — report sent to HQ`);
      else if (dates.length > 1) ui.showToast(`Closed ${dates.length} past days automatically`);
    })
    .catch(() => {});
});
</script>

<template>
  <div class="h-full flex flex-col bg-cream text-ink">
    <RouterView />
    <Toast />
  </div>
</template>
