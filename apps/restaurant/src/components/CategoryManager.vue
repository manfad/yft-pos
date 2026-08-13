<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { YfKeyboard } from "@yf/ui";
import { useRestaurantStore } from "../stores/restaurant";

const store = useRestaurantStore();
const keyboardOpen = shallowRef(false);
const message = shallowRef("");
const rows = computed(() => store.categories.map((name) => ({ name, count: store.menuItems.filter((item) => item.category === name).length })));
function add(value: string): void { message.value = store.addCategory(value) ? "" : "That category already exists or has no name."; keyboardOpen.value = false; }
function remove(name: string): void { message.value = store.deleteCategory(name) ? "" : `Move all items out of ${name} before deleting it.`; }
</script>

<template>
  <section class="h-full flex flex-col gap-16px">
    <div class="flex items-center"><div><h2 class="m-0 font-display text-27px">Categories</h2><p class="m-0 mt-3px text-14px font-700 text-muted">Categories become options in the menu item selector.</p></div><button class="yf-btn-primary ml-auto" @click="keyboardOpen = true">+ Add category</button></div>
    <p v-if="message" class="m-0 px-16px py-12px rounded-14px bg-dangerSoft text-danger font-900" role="alert">{{ message }}</p>
    <div class="yf-card overflow-auto">
      <div v-for="row in rows" :key="row.name" class="flex items-center gap-16px min-h-72px px-20px border-b border-borderSoft"><strong class="flex-1 text-18px">{{ row.name }}</strong><span class="yf-chip bg-panel text-muted">{{ row.count }} items</span><button class="yf-btn-danger min-h-42px h-42px" :disabled="row.count > 0" @click="remove(row.name)">Delete</button></div>
    </div>
  </section>
  <YfKeyboard :open="keyboardOpen" title="New category name" initial="" @confirm="add" @close="keyboardOpen = false" />
</template>
