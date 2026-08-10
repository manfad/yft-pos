<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { buildReceipt, fmtMoney, unitLabel, type PaymentMethod } from "@yf/core";
import TopBar from "../components/TopBar.vue";
import ProductCard from "../components/ProductCard.vue";
import CartLine from "../components/CartLine.vue";
import ItemAdjustSheet from "../components/ItemAdjustSheet.vue";
import PayDialog from "../components/PayDialog.vue";
import CreditorDialog from "../components/CreditorDialog.vue";
import NumpadDialog from "../components/NumpadDialog.vue";
import { useCatalog } from "../stores/catalog";
import { useCart } from "../stores/cart";
import { useUi } from "../stores/ui";
import { currentCompany } from "../place";
import { printer } from "../printing/printer";
import { getRepo } from "../db";

const catalog = useCatalog();
const cart = useCart();
const ui = useUi();
const payOpen = ref(false);
const adjustSheetOpen = ref(false);

// Credit (pay-later): the picker and the list of previous creditor names.
const creditorOpen = ref(false);
const creditorNames = ref<string[]>([]);
async function openCreditor(): Promise<void> {
  payOpen.value = false;
  const repo = await getRepo();
  const credits = await repo.listCredits(currentCompany.value.id);
  // Distinct names, most-recent first (listCredits is ordered by date desc).
  creditorNames.value = [...new Set(credits.map((c) => c.name))];
  creditorOpen.value = true;
}
async function confirmCredit(name: string): Promise<void> {
  creditorOpen.value = false;
  const order = await cart.pay("Credit", name);
  if (order) {
    ui.showToast(`Credit · ${name} · ${fmtMoney(order.totalCents)}`);
    void printer
      .print(buildReceipt(order, { storeName: currentCompany.value.name }))
      .catch(() => ui.showToast("Printing failed"));
  }
}

onMounted(() => {
  if (catalog.items.length === 0) void catalog.load();
});

const active = computed(() => cart.active);
// The cart shows a Tail column only when at least one line tracks tail.
const hasTail = computed(() => cart.lines.some((l) => l.item.tracksTail));
watch(active, (line) => {
  if (!line) adjustSheetOpen.value = false;
});

function addItem(item: Parameters<typeof cart.add>[0]): void {
  cart.add(item);
  adjustSheetOpen.value = true;
}
function selectLine(uid: number): void {
  cart.select(uid);
  adjustSheetOpen.value = true;
}

// numpad: tap any quantity (or tail count) to type it directly (touchscreen-friendly)
const numpadUid = ref<number | null>(null);
const numpadMode = ref<"qty" | "tail">("qty");
const numpadLine = computed(() =>
  numpadUid.value == null ? null : (cart.lines.find((l) => l.uid === numpadUid.value) ?? null),
);
function openNumpad(uid?: number, mode: "qty" | "tail" = "qty"): void {
  const id = uid ?? active.value?.uid ?? null;
  if (id != null) {
    numpadMode.value = mode;
    numpadUid.value = id;
  }
}
function confirmQty(value: number): void {
  if (numpadUid.value != null) {
    if (numpadMode.value === "tail") cart.setTail(numpadUid.value, value);
    else cart.setQty(numpadUid.value, value);
  }
  numpadUid.value = null;
}

function openPay(): void {
  if (cart.totalCents <= 0) return;
  // Don't sell a tail-tracking line until its head count is entered.
  const missing = cart.missingTail;
  if (missing) {
    cart.select(missing.uid);
    const needsWeight = missing.qtyMilli <= 0;
    const needsTail = missing.tailCount <= 0;
    const needed = needsWeight && needsTail ? "weight and Ekor" : needsWeight ? "weight" : "Ekor";
    ui.showToast(`Enter ${needed} for ${missing.item.name}`);
    return;
  }
  payOpen.value = true;
}
async function confirm(method: PaymentMethod): Promise<void> {
  const order = await cart.pay(method);
  payOpen.value = false;
  if (order) {
    ui.showToast(`Payment complete · ${method} · ${fmtMoney(order.totalCents)}`);
    // Auto-print the receipt on payment.
    void printer
      .print(buildReceipt(order, { storeName: currentCompany.value.name }))
      .catch(() => ui.showToast("Printing failed"));
  }
}
</script>

<template>
  <TopBar mode="till" />

  <div class="till-layout flex-1 flex gap-20px p-20px min-h-0">
    <!-- left: product grid + adjuster -->
    <div class="catalog-pane relative overflow-hidden flex-[0_0_600px] flex flex-col min-h-0">
      <div
        class="product-grid grid grid-cols-4 gap-14px overflow-y-auto content-start pr-4px"
        style="grid-auto-rows: 128px"
      >
        <ProductCard
          v-for="item in catalog.items"
          :key="item.id"
          :item="item"
          @add="addItem(item)"
        />
      </div>

      <ItemAdjustSheet
        :open="adjustSheetOpen"
        :line="active"
        @close="adjustSheetOpen = false"
        @adjust-qty="cart.adjust"
        @edit-qty="openNumpad()"
        @adjust-tail="cart.adjustTail"
        @edit-tail="openNumpad(undefined, 'tail')"
      />
    </div>

    <!-- right: current sale -->
    <div class="flex-1 flex flex-col bg-surface border-2 border-border rounded-22px overflow-hidden min-h-0">
      <div class="flex items-center justify-between px-20px py-16px border-b-2 border-borderSoft flex-none">
        <span class="text-21px font-800">Current Sale</span>
        <button class="pill-btn h-42px px-16px text-15px" @click="cart.clear()">Clear</button>
      </div>
      <!-- column header (aligned to CartLine's grid) -->
      <div
        v-if="cart.lines.length"
        class="cart-header flex-none pt-14px pb-6px grid items-center gap-8px text-12px font-800 text-muted uppercase tracking-wide"
        :class="hasTail ? 'cart-grid-tail' : 'cart-grid-standard'"
        style="padding-left: 28px; padding-right: 28px"
      >
        <div class="cart-item">Item</div>
        <div v-if="hasTail" class="cart-tail text-center">Ekor</div>
        <div class="cart-qty-group text-center">Qty</div>
        <div class="cart-price text-right">Price</div>
        <div class="cart-remove" />
      </div>
      <div class="flex-1 overflow-auto px-16px pb-14px flex flex-col gap-10px">
        <div
          v-if="cart.lines.length === 0"
          class="flex-1 flex flex-col items-center justify-center gap-10px text-faint py-40px"
        >
          <div class="text-48px">🛒</div>
          <div class="text-18px font-800">Tap a product to start</div>
        </div>
        <CartLine
          v-for="line in cart.lines"
          :key="line.uid"
          :line="line"
          :active="line.uid === cart.activeUid"
          :amount-cents="cart.amountOf(line)"
          :has-tail="hasTail"
          @select="selectLine(line.uid)"
          @step="(d) => cart.step(line.uid, d)"
          @edit="openNumpad(line.uid)"
          @step-tail="(d) => cart.stepTail(line.uid, d)"
          @edit-tail="openNumpad(line.uid, 'tail')"
          @remove="cart.remove(line.uid)"
        />
      </div>
      <div class="px-20px py-18px border-t-2 border-borderSoft bg-panel flex-none">
        <div class="flex items-baseline justify-between mb-14px">
          <span class="text-23px font-800">AMOUNT</span>
          <span class="font-display text-44px font-700 text-terracotta whitespace-nowrap">{{ fmtMoney(cart.totalCents) }}</span>
        </div>
        <button class="btn-pay w-full h-74px text-29px" @click="openPay">PAY</button>
      </div>
    </div>
  </div>

  <PayDialog
    :open="payOpen"
    :total-cents="cart.totalCents"
    @confirm="confirm"
    @credit="openCreditor"
    @close="payOpen = false"
  />

  <CreditorDialog
    :open="creditorOpen"
    :total-cents="cart.totalCents"
    :names="creditorNames"
    @confirm="confirmCredit"
    @close="creditorOpen = false"
  />

  <NumpadDialog
    :open="numpadLine !== null"
    :title="`${numpadLine?.item.name ?? ''} — ${numpadMode === 'tail' ? 'Ekor' : 'quantity'}`"
    :unit="numpadMode === 'tail' ? 'ekor' : unitLabel(numpadLine?.item.unit ?? 'each')"
    :initial="numpadLine ? (numpadMode === 'tail' ? numpadLine.tailCount : numpadLine.qtyMilli / 1000) : 0"
    @confirm="confirmQty"
    @close="numpadUid = null"
  />
</template>

<style scoped>
@media (max-width: 1100px) {
  .till-layout {
    gap: 12px;
    padding: 12px;
  }
  .catalog-pane {
    flex-basis: 390px;
  }
  .product-grid {
    flex: 1 1 0;
    min-height: 0;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 112px !important;
    gap: 10px;
  }
  .cart-header {
    padding-inline: 20px !important;
  }
}

.product-grid {
  flex: 1 1 0;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .product-grid { scroll-behavior: auto; }
}
</style>
