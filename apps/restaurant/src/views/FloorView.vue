<script setup lang="ts">
import { onUnmounted, ref, shallowRef, watch } from "vue";
import { YfConfirmDialog } from "@yf/ui";
import { orderTotal } from "../domain/restaurant";
import type { OrderLine, PaymentMethod, RestaurantOrder, RestaurantTable, ServiceType } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";
import { useRestaurantUiStore } from "../stores/ui";
import AssignTableDialog from "../components/AssignTableDialog.vue";
import CheckoutDialog from "../components/CheckoutDialog.vue";
import FloorPlan from "../components/FloorPlan.vue";
import OrderDetailDialog from "../components/OrderDetailDialog.vue";
import OrderDialog from "../components/OrderDialog.vue";
import OrderSidebar from "../components/OrderSidebar.vue";
import ServiceTypeDialog from "../components/ServiceTypeDialog.vue";

const store = useRestaurantStore();
const ui = useRestaurantUiStore();
const floorZoom = shallowRef(0.85);
const draggingOrder = shallowRef(false);
const dropTargetId = shallowRef<string | null>(null);
const dropBlocked = shallowRef(false);
const landedTableId = shallowRef<string | null>(null);
let landTimer: ReturnType<typeof setTimeout> | undefined;
const editingOrder = ref<RestaurantOrder | null>(null);
const detailOrder = ref<RestaurantOrder | null>(null);
const orderOpen = shallowRef(false);
const serviceOpen = shallowRef(false);
const assignOrder = ref<RestaurantOrder | null>(null);
const checkoutOrder = ref<RestaurantOrder | null>(null);
const cancelOrder = ref<RestaurantOrder | null>(null);
const pendingLines = ref<OrderLine[]>([]);
const preferredTableId = shallowRef<string | null>(null);
watch(() => ui.newOrderRequest, () => newOrder());

function newOrder(tableId: string | null = null): void { editingOrder.value = null; pendingLines.value = []; preferredTableId.value = tableId; orderOpen.value = true; }
function editOrder(order: RestaurantOrder): void { detailOrder.value = null; editingOrder.value = order; orderOpen.value = true; }
function preparePlacement(lines: OrderLine[]): void { pendingLines.value = lines; orderOpen.value = false; serviceOpen.value = true; }
function createOrder(serviceType: ServiceType, tableId: string | null): void {
  store.createOrder({ lines: pendingLines.value, serviceType, tableId });
  pendingLines.value = []; preferredTableId.value = null; serviceOpen.value = false;
}
function saveOrder(lines: OrderLine[]): void { if (editingOrder.value) store.updateOrder(editingOrder.value.id, lines); editingOrder.value = null; orderOpen.value = false; }
function openTable(table: RestaurantTable): void { const order = store.tableOrder(table.id); if (order) detailOrder.value = order; else newOrder(table.id); }
function openAssign(order: RestaurantOrder): void { detailOrder.value = null; assignOrder.value = order; }
function saveAssign(tableId: string | null): void { if (assignOrder.value) store.assignTable(assignOrder.value.id, tableId); assignOrder.value = null; }
function openCheckout(order: RestaurantOrder): void { detailOrder.value = null; checkoutOrder.value = order; }
function completeCheckout(lines: OrderLine[], method: PaymentMethod, receivedCents?: number): void {
  if (!checkoutOrder.value) return;
  const total = orderTotal({ lines });
  store.checkout(checkoutOrder.value.id, lines, { method, paidCents: total, receivedCents });
  checkoutOrder.value = null;
}
function requestCancel(order: RestaurantOrder): void { detailOrder.value = null; cancelOrder.value = order; }
function confirmCancel(): void { if (cancelOrder.value) store.cancelOrder(cancelOrder.value.id); cancelOrder.value = null; }
function trackDrag(tableId: string | null, blocked: boolean): void { dropTargetId.value = tableId; dropBlocked.value = blocked; }
function dropOnTable(order: RestaurantOrder, tableId: string): void {
  if (!store.assignTable(order.id, tableId)) return;
  landedTableId.value = tableId;
  clearTimeout(landTimer);
  landTimer = setTimeout(() => { landedTableId.value = null; }, 480);
}
onUnmounted(() => clearTimeout(landTimer));
</script>

<template>
  <div class="h-full flex min-h-0">
    <OrderSidebar @edit="editOrder" @checkout="openCheckout" @assign="openAssign" @cancel="requestCancel" @drop-table="dropOnTable" @dragging="draggingOrder = $event" @drag-over="trackDrag" />
    <section class="relative flex-1 min-w-0 min-h-0">
      <FloorPlan :edit-mode="false" :selected-table-id="null" :zoom="floorZoom" :dragging-order="draggingOrder" :drop-target-id="dropTargetId" :drop-blocked="dropBlocked" :landed-table-id="landedTableId" @open="openTable" />
      <div class="absolute right-18px bottom-18px flex items-center gap-6px p-6px rounded-16px border-2 border-border bg-surface/95 shadow-[0_4px_0_theme(colors.border)]">
        <button class="yf-btn min-h-40px h-40px px-12px" aria-label="Zoom floor out" @click="floorZoom = Math.max(.55, floorZoom - .1)">−</button>
        <span class="min-w-52px text-center text-14px font-900">{{ Math.round(floorZoom * 100) }}%</span>
        <button class="yf-btn min-h-40px h-40px px-12px" aria-label="Zoom floor in" @click="floorZoom = Math.min(1.15, floorZoom + .1)">+</button>
      </div>
    </section>
  </div>

  <OrderDialog :open="orderOpen" :order="editingOrder" :initial-lines="pendingLines" @place="preparePlacement" @save="saveOrder" @close="orderOpen = false" />
  <ServiceTypeDialog :open="serviceOpen" :preferred-table-id="preferredTableId" @confirm="createOrder" @close="serviceOpen = false; orderOpen = true" />
  <OrderDetailDialog :open="detailOrder !== null" :order="detailOrder" @edit="detailOrder && editOrder(detailOrder)" @assign="detailOrder && openAssign(detailOrder)" @checkout="detailOrder && openCheckout(detailOrder)" @cancel="detailOrder && requestCancel(detailOrder)" @close="detailOrder = null" />
  <AssignTableDialog :open="assignOrder !== null" :order="assignOrder" @confirm="saveAssign" @close="assignOrder = null" />
  <CheckoutDialog :open="checkoutOrder !== null" :order="checkoutOrder" @confirm="completeCheckout" @close="checkoutOrder = null" />
  <YfConfirmDialog :open="cancelOrder !== null" title="Cancel this order?" message="All active items will be struck through, the order will move to Done, and it will not count toward sales." confirm-label="Cancel order" danger @confirm="confirmCancel" @close="cancelOrder = null" />
</template>
