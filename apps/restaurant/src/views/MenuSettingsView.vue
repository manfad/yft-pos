<script setup lang="ts">
import { shallowRef } from "vue";
import { YfPageSwitcher } from "@yf/ui";
import CategoryManager from "../components/CategoryManager.vue";
import MenuManager from "../components/MenuManager.vue";
import TableLayoutEditor from "../components/TableLayoutEditor.vue";

const section = shallowRef("items");
const options = [{ value: "items", label: "Menu items" }, { value: "categories", label: "Categories" }, { value: "tables", label: "Tables" }];
</script>

<template>
  <div class="h-full p-22px flex flex-col gap-18px">
    <YfPageSwitcher class="self-start" v-model="section" :options="options" />
    <div class="flex-1 min-h-0">
      <MenuManager v-if="section === 'items'" />
      <CategoryManager v-else-if="section === 'categories'" />
      <TableLayoutEditor v-else />
    </div>
  </div>
</template>
