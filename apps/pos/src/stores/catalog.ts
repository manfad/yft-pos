import { defineStore } from "pinia";
import { ref, watch } from "vue";
import type { PricedItem } from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";

export const useCatalog = defineStore("catalog", () => {
  const items = ref<PricedItem[]>([]);
  const loading = ref(false);
  let lastIncludeInactive = false;
  let loadedOnce = false;

  async function load(includeInactive = false): Promise<void> {
    lastIncludeInactive = includeInactive;
    loadedOnce = true;
    loading.value = true;
    try {
      const repo = await getRepo();
      items.value = await repo.listItems(includeInactive, currentCompany.value.id);
    } finally {
      loading.value = false;
    }
  }

  // Reload whenever the company changes so the till/admin show the right catalogue.
  watch(
    () => currentCompany.value.id,
    () => {
      if (loadedOnce) void load(lastIncludeInactive);
    },
  );

  return { items, loading, load };
});
