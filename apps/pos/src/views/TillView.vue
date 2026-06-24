<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { buildReceipt, fmtMoney, fmtQtyUnit, unitLabel, type PaymentMethod } from "@yf/core";
import TopBar from "../components/TopBar.vue";
import ProductCard from "../components/ProductCard.vue";
import CartLine from "../components/CartLine.vue";
import PayDialog from "../components/PayDialog.vue";
import NumpadDialog from "../components/NumpadDialog.vue";
import { useCatalog } from "../stores/catalog";
import { useCart } from "../stores/cart";
import { useUi } from "../stores/ui";
import { currentCompany } from "../place";
import { printer } from "../printing/printer";

const catalog = useCatalog();
const cart = useCart();
const ui = useUi();
const payOpen = ref(false);

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
const activeMathStr = computed(() => {
  const l = active.value;
  if (!l) return "Tap a product, then set the quantity";
  return `${fmtMoney(cart.unitCentsOf(l))} × ${fmtQtyUnit(l.qtyMilli, l.item.unit)}  =  ${fmtMoney(cart.amountOf(l))}`;
});
const activeTiers = computed(() => {
  const l = active.value;
  if (!l || l.item.tiers.length === 0) return [];
  return [...l.item.tiers]
    .sort((a, b) => a.minQtyMilli - b.minQtyMilli)
    .map((t) => ({
      id: t.id,
      qtyText: fmtQtyUnit(t.minQtyMilli, l.item.unit),
      priceText: `${fmtMoney(t.priceCents)}/${unitLabel(l.item.unit)}`,
      // "hit" = the current quantity has reached this threshold.
      active: l.qtyMilli >= t.minQtyMilli,
    }));
});

// numpad: tap any quantity to type it directly (touchscreen-friendly)
const numpadUid = ref<number | null>(null);
const numpadLine = computed(() =>
  numpadUid.value == null ? null : (cart.lines.find((l) => l.uid === numpadUid.value) ?? null),
);
function openNumpad(uid?: number): void {
  const id = uid ?? active.value?.uid ?? null;
  if (id != null) numpadUid.value = id;
}
function confirmQty(value: number): void {
  if (numpadUid.value != null) cart.setQty(numpadUid.value, value);
  numpadUid.value = null;
}

function openPay(): void {
  if (cart.totalCents > 0) payOpen.value = true;
}
async function confirm(method: PaymentMethod): Promise<void> {
  const order = await cart.pay(method);
  payOpen.value = false;
  if (order) {
    ui.showToast(`${method} · ${fmtMoney(order.totalCents)}`);
    // Auto-print the receipt on payment.
    void printer
      .print(buildReceipt(order, { storeName: currentCompany.value.name }))
      .catch(() => ui.showToast("Printing failed"));
  }
}
</script>

<template>
  <TopBar mode="till" />

  <div class="flex-1 flex gap-20px p-20px min-h-0">
    <!-- left: product grid + adjuster -->
    <div class="flex-[0_0_600px] flex flex-col gap-16px min-h-0">
      <div
        class="grid grid-cols-4 gap-14px overflow-y-auto content-start pr-4px"
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
      <div class="bg-surface border-2 border-border rounded-18px p-16px flex flex-col gap-13px flex-none">
        <div class="flex items-center gap-10px min-h-26px flex-wrap">
          <div
            v-if="active"
            class="text-15px font-800 text-muted bg-[#f4ecdc] rounded-full px-10px py-4px whitespace-nowrap"
          >{{ activePriceStr }}</div>
          <span
            v-for="t in activeTiers"
            :key="t.id"
            class="inline-flex items-center gap-5px text-16px font-800 rounded-full px-12px py-5px border-2 whitespace-nowrap transition-colors"
            :class="t.active ? 'bg-olive text-white border-olive' : 'bg-[#ece6d8] text-muted border-borderSoft'"
            :title="t.active ? 'Bulk price applied' : 'Bulk price available'"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 15 6-6 6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ t.qtyText }} → {{ t.priceText }}
          </span>
        </div>
        <div class="flex items-center gap-14px">
          <button class="adj-btn w-64px h-64px text-34px" @click="cart.adjust(-0.5)">−</button>
          <button
            class="flex-1 text-center font-display text-42px font-600 bg-[#f4ecdc] rounded-14px py-6px border-2 border-transparent cursor-pointer press disabled:cursor-default"
            :disabled="!active"
            title="Tap to type quantity"
            @click="openNumpad()"
          >
            {{ activeQtyStr }}
          </button>
          <button class="adj-btn w-64px h-64px text-34px" @click="cart.adjust(0.5)">+</button>
        </div>
        <div class="text-center text-17px font-800 text-terracotta">{{ activeMathStr }}</div>
        <div class="grid grid-cols-4 gap-10px">
          <button class="tile-dark h-58px text-20px" @click="cart.adjust(-10)">− 10</button>
          <button class="tile-dark h-58px text-20px" @click="cart.adjust(-1)">− 1</button>
          <button class="tile-warm h-58px text-20px" @click="cart.adjust(1)">+ 1</button>
          <button class="tile-warm h-58px text-20px" @click="cart.adjust(10)">+ 10</button>
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
        class="flex-none pt-14px pb-6px grid items-center gap-12px grid-cols-[minmax(0,1fr)_220px_150px_44px] text-12px font-800 text-muted uppercase tracking-wide"
        style="padding-left: 32px; padding-right: 32px"
      >
        <div>Item</div>
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
          @select="cart.select(line.uid)"
          @step="(d) => cart.step(line.uid, d)"
          @edit="openNumpad(line.uid)"
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
    @close="payOpen = false"
  />

  <NumpadDialog
    :open="numpadLine !== null"
    :title="`${numpadLine?.item.name ?? ''} — quantity`"
    :unit="unitLabel(numpadLine?.item.unit ?? 'each')"
    :initial="numpadLine ? numpadLine.qtyMilli / 1000 : 0"
    @confirm="confirmQty"
    @close="numpadUid = null"
  />
</template>
