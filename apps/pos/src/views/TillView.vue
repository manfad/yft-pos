<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { buildReceipt, fmtMoney, fmtQtyUnit, unitLabel, type PaymentMethod } from "@yf/core";
import TopBar from "../components/TopBar.vue";
import ProductCard from "../components/ProductCard.vue";
import CartLine from "../components/CartLine.vue";
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
const activePriceStr = computed(() =>
  active.value ? `${fmtMoney(cart.unitCentsOf(active.value))} / ${unitLabel(active.value.item.unit)}` : "",
);
const activeQtyStr = computed(() =>
  active.value ? fmtQtyUnit(active.value.qtyMilli, active.value.item.unit) : "—",
);
// Tail ("ekor") adjuster — only shown for items that track a head count.
const activeTracksTail = computed(() => active.value?.item.tracksTail ?? false);
const activeTailStr = computed(() => (active.value ? `${active.value.tailCount} ekor` : "—"));
// The cart shows a Tail column only when at least one line tracks tail.
const hasTail = computed(() => cart.lines.some((l) => l.item.tracksTail));
const activeMathStr = computed(() => {
  const l = active.value;
  if (!l) return "Tap a product, then set the quantity";
  return `${fmtMoney(cart.unitCentsOf(l))} × ${fmtQtyUnit(l.qtyMilli, l.item.unit)}  =  ${fmtMoney(cart.amountOf(l))}`;
});
const activeTiers = computed(() => {
  const l = active.value;
  if (!l || l.item.tiers.length === 0) return [];
  const sorted = [...l.item.tiers].sort((a, b) => a.minQtyMilli - b.minQtyMilli);
  // Only one chip is "active" — the single tier that actually sets the price
  // (the highest threshold the quantity has reached). All others read as gray.
  const reached = sorted.filter((t) => l.qtyMilli >= t.minQtyMilli);
  const appliedId = reached.at(-1)?.id ?? null;
  return sorted.map((t) => ({
    id: t.id,
    qtyText: fmtQtyUnit(t.minQtyMilli, l.item.unit),
    priceText: fmtMoney(t.priceCents),
    active: t.id === appliedId,
  }));
});
// The base price is the active one only while no tier threshold has been reached.
const basePriceActive = computed(() => {
  const l = active.value;
  return !!l && !l.item.tiers.some((t) => l.qtyMilli >= t.minQtyMilli);
});

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
    <div class="catalog-pane flex-[0_0_600px] flex flex-col gap-16px min-h-0">
      <div
        class="product-grid grid grid-cols-4 gap-14px overflow-y-auto content-start pr-4px"
        style="grid-auto-rows: 128px; max-height: calc(128px * 4 + 14px * 3)"
      >
        <ProductCard
          v-for="item in catalog.items"
          :key="item.id"
          :item="item"
          @add="cart.add(item)"
        />
      </div>

      <!-- active-line adjuster -->
      <div class="quantity-adjuster bg-surface border-2 border-border rounded-18px p-16px flex flex-col gap-13px flex-none">
        <div class="price-tiers flex items-center gap-10px min-h-26px flex-wrap">
          <div
            v-if="active"
            class="inline-flex items-center text-15px font-800 rounded-full px-10px py-4px border-2 whitespace-nowrap transition-colors"
            :class="basePriceActive ? 'bg-olive text-white border-olive' : 'bg-[#ece6d8] text-muted border-borderSoft'"
          >{{ activePriceStr }}</div>
          <span
            v-for="t in activeTiers"
            :key="t.id"
            class="inline-flex items-center gap-5px text-15px font-800 rounded-full px-10px py-4px border-2 whitespace-nowrap transition-colors"
            :class="t.active ? 'bg-olive text-white border-olive' : 'bg-[#ece6d8] text-muted border-borderSoft'"
            :title="t.active ? 'Bulk price applied' : 'Bulk price available'"
          >
            {{ t.qtyText }}
            <span class="font-900" :class="t.active ? 'text-white' : 'text-muted'">=</span>
            {{ t.priceText }}
          </span>
        </div>
        <div class="quantity-stepper flex items-center gap-14px">
          <button class="stepper-side adj-btn w-64px h-64px text-34px" @click="cart.adjust(-0.5)">−</button>
          <button
            class="stepper-value flex-1 text-center font-display text-42px font-600 bg-[#f4ecdc] rounded-14px py-6px border-2 border-transparent cursor-pointer press disabled:cursor-default"
            :disabled="!active"
            title="Tap to type quantity"
            @click="openNumpad()"
          >
            {{ activeQtyStr }}
          </button>
          <button class="stepper-side adj-btn w-64px h-64px text-34px" @click="cart.adjust(0.5)">+</button>
        </div>
        <div class="quantity-math text-center text-17px font-800 text-terracotta">{{ activeMathStr }}</div>
        <div class="quick-grid grid grid-cols-4 gap-10px">
          <button class="quick-button tile-dark h-58px text-20px" @click="cart.adjust(-10)">− 10</button>
          <button class="quick-button tile-dark h-58px text-20px" @click="cart.adjust(-1)">− 1</button>
          <button class="quick-button tile-warm h-58px text-20px" @click="cart.adjust(1)">+ 1</button>
          <button class="quick-button tile-warm h-58px text-20px" @click="cart.adjust(10)">+ 10</button>
        </div>
      </div>

      <!-- tail ("ekor") adjuster — a head count for fish/chicken, independent of kg -->
      <div
        v-if="activeTracksTail"
        class="tail-adjuster bg-surface border-2 border-olive rounded-18px p-16px flex flex-col gap-13px flex-none"
      >
        <div class="quantity-stepper flex items-center gap-14px">
          <button class="stepper-side adj-btn w-64px h-64px text-34px" @click="cart.adjustTail(-1)">−</button>
          <button
            class="stepper-value flex-1 text-center font-display text-42px font-600 bg-[#eef0e0] rounded-14px py-6px border-2 border-transparent cursor-pointer press disabled:cursor-default"
            :disabled="!active"
            title="Tap to type Ekor"
            @click="openNumpad(undefined, 'tail')"
          >
            {{ activeTailStr }}
          </button>
          <button class="stepper-side adj-btn w-64px h-64px text-34px" @click="cart.adjustTail(1)">+</button>
        </div>
        <div class="quick-grid grid grid-cols-4 gap-10px">
          <button class="quick-button tile-dark h-58px text-20px" @click="cart.adjustTail(-10)">− 10</button>
          <button class="quick-button tile-dark h-58px text-20px" @click="cart.adjustTail(-1)">− 1</button>
          <button class="quick-button tile-warm h-58px text-20px" @click="cart.adjustTail(1)">+ 1</button>
          <button class="quick-button tile-warm h-58px text-20px" @click="cart.adjustTail(10)">+ 10</button>
        </div>
      </div>
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
        <div>Item</div>
        <div v-if="hasTail" class="text-center">Ekor</div>
        <div class="text-center">Qty</div>
        <div class="text-right">Price</div>
        <div />
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
          @select="cart.select(line.uid)"
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
    gap: 10px;
  }
  .product-grid {
    flex: 1 1 0;
    min-height: 0;
    max-height: none !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 112px !important;
    gap: 10px;
  }
  .quantity-adjuster,
  .tail-adjuster {
    padding: 10px;
    gap: 8px;
  }
  .price-tiers {
    gap: 6px;
  }
  .quantity-stepper {
    gap: 10px;
  }
  .stepper-side {
    width: 52px;
    height: 52px;
    font-size: 28px;
  }
  .stepper-value {
    min-height: 52px;
    padding-block: 2px;
    font-size: 34px;
  }
  .quantity-math {
    font-size: 14px;
  }
  .quick-grid {
    gap: 7px;
  }
  .quick-button {
    height: 46px;
    font-size: 17px;
  }
  .cart-header {
    padding-inline: 20px !important;
  }
}
</style>
