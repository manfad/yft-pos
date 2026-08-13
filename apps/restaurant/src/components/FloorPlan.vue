<script setup lang="ts">
import { shallowRef, useTemplateRef } from "vue";
import type { RestaurantTable } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";

const props = withDefaults(defineProps<{ editMode: boolean; selectedTableId: string | null; zoom?: number; draggingOrder?: boolean; dropTargetId?: string | null; dropBlocked?: boolean; landedTableId?: string | null }>(), { zoom: 1, draggingOrder: false, dropTargetId: null, dropBlocked: false, landedTableId: null });
const emit = defineEmits<{ open: [table: RestaurantTable]; select: [table: RestaurantTable]; move: [id: string, x: number, y: number] }>();
const store = useRestaurantStore();
const surface = useTemplateRef<HTMLElement>("surface");
const draggingId = shallowRef<string | null>(null);
let moved = false;

function down(event: PointerEvent, table: RestaurantTable): void {
  if (!props.editMode) return;
  draggingId.value = table.id; moved = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent, table: RestaurantTable): void {
  if (draggingId.value !== table.id || !surface.value) return;
  const rect = surface.value.getBoundingClientRect();
  const x = Math.max(2, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(2, Math.min(84, ((event.clientY - rect.top) / rect.height) * 100));
  moved = true; emit("move", table.id, x, y);
}
function up(table: RestaurantTable): void {
  if (draggingId.value !== table.id) return;
  draggingId.value = null;
  if (!moved) emit("select", table);
}
</script>

<template>
  <div ref="surface" class="relative h-full overflow-hidden bg-[radial-gradient(circle_at_center,#fffdf8_0,#f8f1e4_78%)]" :class="editMode ? 'floor-grid' : ''">
    <button
      v-for="table in store.tables"
      :key="table.id"
      class="restaurant-table absolute rounded-[50%] border-3 font-900 cursor-pointer yf-focus shadow-[0_8px_0_rgba(44,38,32,.14)]"
      :class="[
        store.tableOrder(table.id) ? 'bg-occupied border-[#d0a72e]' : 'bg-surface border-border',
        editMode ? 'touch-none cursor-move' : 'press',
        selectedTableId === table.id ? 'outline-4 outline-terracotta outline-offset-5' : '',
        draggingOrder && !store.tableOrder(table.id) ? 'drop-ready' : '',
        dropTargetId === table.id ? (dropBlocked ? 'drop-blocked' : 'drop-hot') : '',
        landedTableId === table.id ? 'table-landed' : ''
      ]"
      :style="{ left: `${table.x}%`, top: `${table.y}%`, '--table-zoom': zoom }"
      :data-table-id="table.id"
      @pointerdown="down($event, table)"
      @pointermove="move($event, table)"
      @pointerup="up(table)"
      @click="!editMode && emit('open', table)"
    >
      <span class="block">{{ table.label }}</span>
      <span class="block mt-3px text-13px font-800" :class="store.tableOrder(table.id) ? 'text-[#775d0c]' : 'text-muted'">{{ store.tableOrder(table.id) ? 'Ongoing order' : editMode ? 'Drag to move' : 'Available' }}</span>
    </button>
  </div>
</template>

<style scoped>
.floor-grid { background-color: #f8f1e4; background-image: linear-gradient(#dfd2bb 1px, transparent 1px), linear-gradient(90deg, #dfd2bb 1px, transparent 1px); background-size: 36px 36px; }
.restaurant-table { translate: -50% 0; width: calc(170px * var(--table-zoom)); height: calc(104px * var(--table-zoom)); font-size: calc(20px * var(--table-zoom)); transition: transform 160ms cubic-bezier(.2, .8, .3, 1), background-color 160ms ease, outline-color 160ms ease; }
.restaurant-table span:last-child { font-size: calc(13px * var(--table-zoom)); }
.drop-ready { outline: 4px dashed #6e8a4e; outline-offset: 5px; background: #e8f0dc; }
.drop-hot { outline: 5px solid #6e8a4e; outline-offset: 7px; background: #d8e8c1; transform: scale(1.09); box-shadow: 0 16px 0 rgba(44, 38, 32, .16); }
.drop-blocked { outline: 5px solid #c84d42; outline-offset: 6px; background: #f8e5e1; }
.table-landed { animation: table-land 460ms cubic-bezier(.2, .8, .3, 1.2); }
@keyframes table-land {
  0% { transform: scale(1.16); }
  55% { transform: scale(.96); }
  100% { transform: scale(1); }
}
</style>
