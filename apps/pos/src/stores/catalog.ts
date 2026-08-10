import { defineStore } from "pinia";
import { ref } from "vue";
import type { PricedItem } from "@yf/core";
import { getRepo } from "../db";

export const useCatalog = defineStore("catalog", () => {
  const items = ref<PricedItem[]>([]);
  const loading = ref(false);

  async function load(includeInactive = false): Promise<void> {
    loading.value = true;
    try {
      const repo = await getRepo();
      items.value = await repo.listItems(includeInactive);
    } finally {
      loading.value = false;
    }
  }

  return { items, loading, load };
});
