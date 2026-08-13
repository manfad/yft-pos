<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, shallowRef, useTemplateRef } from "vue";
import dayjs from "dayjs";
import { money, orderLabel, orderTotal } from "../domain/restaurant";
import type { RestaurantOrder } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";

const emit = defineEmits<{ edit: [order: RestaurantOrder]; checkout: [order: RestaurantOrder]; assign: [order: RestaurantOrder]; cancel: [order: RestaurantOrder]; dropTable: [order: RestaurantOrder, tableId: string]; dragging: [active: boolean]; dragOver: [tableId: string | null, blocked: boolean] }>();
const store = useRestaurantStore();
const tab = shallowRef<"ongoing" | "done">("ongoing");
const expandedId = shallowRef<string | null>(null);
const list = computed(() => tab.value === "ongoing" ? store.ongoingOrders : store.doneOrders);
function tableName(order: RestaurantOrder): string | undefined { return store.tables.find((table) => table.id === order.tableId)?.label; }

const drag = reactive<{ order: RestaurantOrder | null; x: number; y: number; tableId: string | null; blocked: boolean }>({ order: null, x: 0, y: 0, tableId: null, blocked: false });
const ghost = useTemplateRef<HTMLElement>("ghost");
const hoverLabel = computed(() => store.tables.find((table) => table.id === drag.tableId)?.label ?? "");
const dropHint = computed(() => !drag.tableId ? "Drop on a table" : drag.blocked ? `${hoverLabel.value} is taken` : `Drop on ${hoverLabel.value}`);
const draggable = (order: RestaurantOrder): boolean => order.status === "ongoing" && order.serviceType === "dine_in";
let sourceEl: HTMLElement | null = null;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let holdFrom = { x: 0, y: 0 };
let suppressClick = false;

const still = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ghostAt = (x: number, y: number, lift: number, tilt: number, scale: number): string => `translate3d(${x}px, ${y - lift}px, 0) translate(-50%, -100%) rotate(${tilt}deg) scale(${scale})`;
const ghostStyle = computed(() => ({ transform: ghostAt(drag.x, drag.y, 24, drag.blocked ? 0 : -3, 1) }));
const tableAt = (x: number, y: number): HTMLElement | null => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-table-id]") ?? null;

function toggle(order: RestaurantOrder): void {
  if (suppressClick) { suppressClick = false; return; }
  expandedId.value = expandedId.value === order.id ? null : order.id;
}
function pressCard(event: PointerEvent, order: RestaurantOrder): void {
  suppressClick = false;
  if (!draggable(order) || drag.order) return;
  holdFrom = { x: event.clientX, y: event.clientY };
  sourceEl = (event.currentTarget as HTMLElement).closest("article");
  holdTimer = setTimeout(() => beginDrag(order, holdFrom.x, holdFrom.y), 300);
  window.addEventListener("pointermove", holdMove);
  window.addEventListener("pointerup", stopHold, { once: true });
  window.addEventListener("pointercancel", stopHold, { once: true });
}
function holdMove(event: PointerEvent): void { if (Math.hypot(event.clientX - holdFrom.x, event.clientY - holdFrom.y) > 12) stopHold(); }
function stopHold(): void {
  clearTimeout(holdTimer);
  window.removeEventListener("pointermove", holdMove);
  window.removeEventListener("pointerup", stopHold);
  window.removeEventListener("pointercancel", stopHold);
}
function grab(event: PointerEvent, order: RestaurantOrder): void {
  event.preventDefault();
  sourceEl = (event.currentTarget as HTMLElement).closest("article");
  beginDrag(order, event.clientX, event.clientY);
}
async function beginDrag(order: RestaurantOrder, x: number, y: number): Promise<void> {
  stopHold();
  suppressClick = true;
  Object.assign(drag, { order, x, y, tableId: null, blocked: false });
  emit("dragging", true);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag, { once: true });
  window.addEventListener("pointercancel", endDrag, { once: true });
  await nextTick();
  if (!still()) ghost.value?.animate([{ transform: ghostAt(x, y, 0, 0, .82), opacity: 0 }, { transform: ghostAt(x, y, 24, -3, 1), opacity: 1 }], { duration: 180, easing: "cubic-bezier(.2,.9,.3,1.2)" });
}
function moveDrag(event: PointerEvent): void {
  drag.x = event.clientX; drag.y = event.clientY;
  const tableId = tableAt(event.clientX, event.clientY)?.dataset.tableId ?? null;
  const holder = tableId ? store.tableOrder(tableId) : undefined;
  const blocked = !!holder && holder.id !== drag.order?.id;
  if (tableId === drag.tableId && blocked === drag.blocked) return;
  drag.tableId = tableId; drag.blocked = blocked;
  emit("dragOver", tableId, blocked);
}
async function endDrag(event: PointerEvent): Promise<void> {
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  const order = drag.order;
  if (!order) return;
  const target = tableAt(event.clientX, event.clientY);
  const tableId = target?.dataset.tableId ?? null;
  const holder = tableId ? store.tableOrder(tableId) : undefined;
  const accepted = !!tableId && (!holder || holder.id === order.id);
  emit("dragging", false);
  emit("dragOver", null, false);
  await settle(accepted ? target : sourceEl, accepted);
  if (accepted && tableId) emit("dropTable", order, tableId);
  Object.assign(drag, { order: null, x: 0, y: 0, tableId: null, blocked: false });
  sourceEl = null;
}
async function settle(target: HTMLElement | null, accepted: boolean): Promise<void> {
  const element = ghost.value;
  if (!element || !target || still()) return;
  const rect = target.getBoundingClientRect();
  const half = element.getBoundingClientRect().height / 2;
  const animation = element.animate([
    { transform: ghostAt(drag.x, drag.y, 24, -3, 1), opacity: 1 },
    { transform: ghostAt(rect.left + rect.width / 2, rect.top + rect.height / 2 + half, 0, 0, accepted ? .3 : .9), opacity: 0 }
  ], { duration: accepted ? 300 : 200, easing: accepted ? "cubic-bezier(.2,.75,.25,1)" : "ease-in", fill: "forwards" });
  await animation.finished.catch(() => undefined);
}
onUnmounted(() => {
  stopHold();
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
});
</script>

<template>
  <aside class="h-full w-390px flex-none flex flex-col bg-surface border-r-2 border-border" aria-label="Today's orders">
    <div class="p-14px grid grid-cols-2 gap-8px border-b-2 border-borderSoft">
      <button class="yf-btn" :class="tab === 'ongoing' ? 'bg-ink text-white border-ink' : ''" @click="tab = 'ongoing'">Ongoing ({{ store.ongoingOrders.length }})</button>
      <button class="yf-btn" :class="tab === 'done' ? 'bg-ink text-white border-ink' : ''" @click="tab = 'done'">Done ({{ store.doneOrders.length }})</button>
    </div>
    <div class="flex-1 p-12px flex flex-col gap-10px" :class="drag.order ? 'overflow-hidden' : 'overflow-auto'">
      <p v-if="!list.length" class="m-auto px-20px text-center text-17px font-800 text-muted">No {{ tab }} orders today.</p>
      <article v-for="order in list" :key="order.id" class="order-card rounded-16px border-2 overflow-hidden" :class="[order.status === 'cancelled' ? 'border-danger bg-dangerSoft/40' : 'border-border bg-panel', drag.order?.id === order.id ? 'is-lifted' : '']">
        <div class="flex items-stretch">
          <button class="flex-1 min-w-0 min-h-74px px-14px py-12px text-left bg-transparent border-0 cursor-pointer" @pointerdown="pressCard($event, order)" @click="toggle(order)"><div class="flex items-start gap-8px"><strong class="flex-1 text-17px" :class="order.status === 'cancelled' ? 'line-through' : ''">{{ orderLabel(order, tableName(order)) }}</strong><span class="text-13px font-800 text-muted">{{ dayjs(order.createdAt).format('h:mm A') }}</span></div><div class="mt-5px flex items-center justify-between"><span class="text-13px font-800" :class="order.status === 'cancelled' ? 'text-danger' : 'text-muted'">{{ order.status === 'cancelled' ? 'Cancelled' : order.serviceType === 'dine_in' ? 'Dine in' : 'Takeaway' }}</span><strong>{{ money(orderTotal(order)) }}</strong></div></button>
          <button v-if="draggable(order)" class="w-54px flex-none border-0 border-l-2 border-borderSoft bg-warm text-25px text-muted cursor-grab touch-none yf-focus" :aria-label="`Drag ${orderLabel(order, tableName(order))} onto a table`" @pointerdown="grab($event, order)">⠿</button>
        </div>
        <div v-if="expandedId === order.id" class="px-14px pb-14px border-t-2 border-borderSoft">
          <ul class="m-0 py-10px pl-20px text-14px font-700 text-muted">
            <li v-for="line in order.lines" :key="line.id" :class="line.status === 'cancelled' ? 'line-through text-danger' : ''">{{ line.quantity }} × {{ line.name }}</li>
          </ul>
          <div v-if="order.status === 'ongoing'" class="grid grid-cols-2 gap-8px">
            <button class="yf-btn min-h-42px h-42px" @click="emit('edit', order)">Edit</button>
            <button class="yf-btn-primary min-h-42px h-42px" @click="emit('checkout', order)">Checkout</button>
            <button v-if="order.serviceType === 'dine_in'" class="yf-btn min-h-42px h-42px" @click="emit('assign', order)">{{ order.tableId ? 'Move table' : 'Assign table' }}</button>
            <button class="yf-btn min-h-42px h-42px text-danger border-danger" @click="emit('cancel', order)">Cancel order</button>
          </div>
          <div v-else class="pt-8px border-t border-border text-13px font-800 text-muted">{{ order.payment ? `${order.payment.method.toUpperCase()} payment` : 'No payment' }}</div>
        </div>
      </article>
    </div>
    <Teleport to="body">
      <div v-if="drag.order" ref="ghost" class="fixed left-0 top-0 z-150 w-330px pointer-events-none rounded-18px border-3 bg-surface overflow-hidden shadow-[0_20px_44px_rgba(44,38,32,.32)]" :class="drag.blocked ? 'border-danger' : 'border-ink'" :style="ghostStyle">
        <div class="px-16px py-12px">
          <div class="flex items-start gap-8px"><strong class="flex-1 text-17px">{{ orderLabel(drag.order, tableName(drag.order)) }}</strong><strong class="text-16px">{{ money(orderTotal(drag.order)) }}</strong></div>
          <span class="block mt-4px text-13px font-800 text-muted">{{ drag.order.lines.length }} item{{ drag.order.lines.length === 1 ? '' : 's' }}</span>
        </div>
        <div class="px-16px py-9px text-14px font-900 text-center" :class="drag.blocked ? 'bg-dangerSoft text-danger' : drag.tableId ? 'bg-olive text-white' : 'bg-warm text-muted'">{{ dropHint }}</div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.order-card { transition: opacity 160ms ease, transform 160ms ease; }
.is-lifted { opacity: .38; transform: scale(.97); }
</style>
