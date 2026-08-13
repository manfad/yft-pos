<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import dayjs from "dayjs";
import { YfPageCycler } from "@yf/ui";
import { useRestaurantUiStore } from "../stores/ui";

const route = useRoute();
const router = useRouter();
const ui = useRestaurantUiStore();
const page = computed(() => (route.name as string | undefined) ?? "floor");
const pageTitle = computed(() => ({ floor: "Floor & Orders", dashboard: "Sales dashboard", menu: "Restaurant settings" }[page.value] ?? "Restaurant"));
const pages = [{ value: "floor", label: "Orders" }, { value: "dashboard", label: "Dashboard" }, { value: "menu", label: "Menu" }];
function switchPage(value: string): void { void router.push(value === "floor" ? "/" : value === "menu" ? "/menu" : "/dashboard"); }
async function newOrder(): Promise<void> { if (page.value !== "floor") await router.push("/"); ui.requestNewOrder(); }
</script>

<template>
  <header class="h-82px flex-none grid grid-cols-[1fr_auto_1fr] items-center gap-20px px-24px bg-surface border-b-2 border-border">
    <YfPageCycler class="justify-self-start" :model-value="page" :options="pages" @update:model-value="switchPage" />
    <div class="text-center min-w-0"><h1 class="m-0 font-display text-27px font-700 leading-tight">{{ pageTitle }}</h1><p class="m-0 text-13px font-800 text-muted">Datuk Yap Fish Poud Restaurant</p></div>
    <div class="justify-self-end flex items-center gap-10px">
      <button class="yf-btn-primary min-w-150px" @click="newOrder">+ New order</button>
      <label v-if="page === 'dashboard'" class="flex items-center min-h-52px px-14px rounded-14px border-2 border-border bg-panel font-900"><span class="mr-10px text-14px text-muted">Date</span><input v-model="ui.reportDate" type="date" class="bg-transparent border-0 font-900 text-16px" aria-label="Sales history date" /></label>
      <div v-else class="flex items-center justify-center min-h-52px px-18px rounded-14px border-2 border-border bg-panel text-16px font-900 whitespace-nowrap">{{ dayjs().format("DD MMM YYYY") }}</div>
    </div>
  </header>
</template>
