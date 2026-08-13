<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { YfConfirmDialog, YfKeyboard } from "@yf/ui";
import { useRestaurantStore } from "../stores/restaurant";
import FloorPlan from "./FloorPlan.vue";

const store = useRestaurantStore();
const selectedId = shallowRef<string | null>(null);
const zoom = shallowRef(.72);
const renameOpen = shallowRef(false);
const deleteOpen = shallowRef(false);
const selected = computed(() => store.tables.find((table) => table.id === selectedId.value) ?? null);
function move(id: string, x: number, y: number): void { store.updateTable(id, { x, y }); }
function add(): void { const table = store.addTable(); selectedId.value = table.id; }
function remove(): void { if (selected.value) store.deleteTable(selected.value.id); selectedId.value = null; deleteOpen.value = false; }
</script>

<template>
  <section class="yf-card h-full overflow-hidden grid grid-cols-[minmax(0,1fr)_310px]">
    <div class="min-w-0 min-h-0"><FloorPlan edit-mode :selected-table-id="selectedId" :zoom="zoom" @select="table => selectedId = table.id" @move="move" /></div>
    <aside class="p-18px bg-panel border-l-2 border-borderSoft flex flex-col min-h-0">
      <h2 class="m-0 mb-14px font-display text-25px">Table layout</h2>
      <div class="grid grid-cols-2 gap-8px"><button class="yf-btn-primary col-span-2" @click="add">+ Add table</button><button class="yf-btn" :disabled="!selected" @click="renameOpen = true">Rename</button><button class="yf-btn-danger" :disabled="!selected || !!(selected && store.tableOrder(selected.id))" @click="deleteOpen = true">Delete</button></div>
      <div class="mt-16px flex items-center gap-7px"><span class="text-14px font-900 text-muted">Table size</span><button class="yf-btn ml-auto min-h-40px h-40px px-12px" aria-label="Smaller tables" @click="zoom = Math.max(.45, zoom - .08)">−</button><strong class="min-w-48px text-center">{{ Math.round(zoom * 100) }}%</strong><button class="yf-btn min-h-40px h-40px px-12px" aria-label="Larger tables" @click="zoom = Math.min(1.1, zoom + .08)">+</button></div>
      <p class="text-13px font-700 text-muted">Drag tables on the floor. Smaller table size makes layouts with 30+ tables easier to manage. Occupied tables cannot be deleted.</p>
      <div class="flex-1 min-h-0 overflow-auto mt-8px flex flex-col gap-6px"><button v-for="table in store.tables" :key="table.id" class="yf-btn min-h-42px h-42px text-left" :class="selectedId === table.id ? 'bg-ink text-white border-ink' : ''" @click="selectedId = table.id">{{ table.label }}<span v-if="store.tableOrder(table.id)" class="float-right text-occupied">Occupied</span></button></div>
    </aside>
  </section>
  <YfKeyboard :open="renameOpen" title="Rename table" :initial="selected?.label ?? ''" @confirm="value => { if (selected && value) store.updateTable(selected.id, { label: value }); renameOpen = false }" @close="renameOpen = false" />
  <YfConfirmDialog :open="deleteOpen" title="Delete table?" :message="`${selected?.label ?? 'This table'} will be removed from the layout.`" confirm-label="Delete table" danger @confirm="remove" @close="deleteOpen = false" />
</template>
