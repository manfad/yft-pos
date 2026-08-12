<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { buildReceipt, fmtMoney, fmtQty, unitLabel, type Order, type OrderLine } from "@yf/core";
import { imageCss } from "../productImage";
import { tintFromName } from "../tint";
import { currentCompany } from "../place";
import { printer } from "../printing/printer";
import { PAYMENT_UI } from "../payments";
import { getRepo } from "../db";
import { useUi } from "../stores/ui";
import PinDialog from "./PinDialog.vue";

const props = defineProps<{ order: Order | null }>();
const emit = defineEmits<{ close: []; voided: [order: Order] }>();

const ui = useUi();

// A sale can be cancelled (voided) only while its business day is still open —
// once the day is closed and reported to HQ, the record is final.
const canVoid = ref(false);
const pinOpen = ref(false);
watch(
  () => props.order,
  async (o) => {
    pinOpen.value = false;
    canVoid.value = false;
    if (!o || o.voidedAt != null) return;
    const repo = await getRepo();
    canVoid.value = (await repo.getDayClose(o.businessDate, o.companyId)) == null;
  },
  { immediate: true },
);

async function doVoid(): Promise<void> {
  pinOpen.value = false;
  const o = props.order;
  if (!o) return;
  const repo = await getRepo();
  await repo.voidOrder(o.id, Date.now());
  ui.showToast(`Sale #${o.invNo} cancelled`);
  const updated = await repo.getOrder(o.id);
  emit("voided", updated ?? o);
}

// Per-unit rate, with the bulk-tier threshold appended when it was applied —
// e.g. "RM 25.00/kg" or "RM 23.00/kg (10kg)". Mirrors the printed receipt.
function rateText(it: OrderLine): string {
  return (
    `${fmtMoney(it.priceCents)}/${unitLabel(it.unit)}` +
    (it.bulkPrice && it.bulkMinQtyMilli != null
      ? ` (${fmtQty(it.bulkMinQtyMilli)}${unitLabel(it.unit, it.bulkMinQtyMilli)})`
      : "")
  );
}

function print(): void {
  if (props.order) {
    void printer.print(buildReceipt(props.order, { storeName: currentCompany.value.name }));
  }
}

const whenStr = computed(() => {
  if (!props.order) return "";
  const d = new Date(props.order.ts);
  return (
    d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
});
</script>

<template>
  <div
    v-if="order"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-70"
    @click.self="$emit('close')"
  >
    <div class="w-540px max-w-full max-h-86vh overflow-auto bg-surface rounded-24px shadow-[0_22px_64px_rgba(0,0,0,.32)]">
      <div class="flex items-center justify-between px-24px py-22px border-b-2 border-borderSoft">
        <div>
          <div class="text-23px font-800">
            Receipt #{{ order.invNo }}
            <span
              v-if="order.voidedAt != null"
              class="inline-flex items-center px-12px py-4px rounded-full bg-[#f8dcd8] border-2 border-[#d94b3d] text-14px font-900 text-[#d94b3d] align-middle ml-6px"
            >CANCELLED</span>
          </div>
          <div class="text-15px font-700 text-muted">{{ whenStr }}</div>
          <div v-if="order.creditorName" class="text-15px font-800 text-[#9a6b34]">{{ order.creditorName }}</div>
        </div>
        <div class="flex items-center gap-12px">
          <span
            class="inline-flex items-center px-14px py-7px rounded-full text-14px font-800 tracking-wide whitespace-nowrap"
            :style="{ color: PAYMENT_UI[order.method].color, background: PAYMENT_UI[order.method].tint }"
          >{{ PAYMENT_UI[order.method].label }}</span>
          <button
            class="w-48px h-48px flex-none rounded-full border-none bg-[#f0e7d6] text-19px font-800 text-muted cursor-pointer"
            @click="$emit('close')"
          >✕</button>
        </div>
      </div>
      <div class="px-24px py-18px flex flex-col gap-14px">
        <div class="flex items-center gap-14px text-12px font-800 text-faint uppercase tracking-wide">
          <div class="w-48px flex-none" />
          <div class="flex-1 min-w-0">Item</div>
          <div class="w-56px flex-none text-center">Sold</div>
          <div class="w-110px flex-none text-right">Earned</div>
        </div>
        <div v-for="it in order.items" :key="it.id" class="flex items-center gap-14px">
          <div
            class="w-48px h-48px flex-none rounded-full"
            :style="{
              backgroundColor: tintFromName(it.name),
              backgroundImage: imageCss(it.image),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }"
          />
          <div class="flex-1 min-w-0">
            <div class="text-18px font-800">{{ it.name }}</div>
            <div class="text-14px font-700 text-muted">{{ rateText(it) }}</div>
          </div>
          <div class="w-56px flex-none text-center font-display text-20px font-700 text-olive">
            {{ fmtQty(it.qtyMilli) }}
          </div>
          <div class="w-110px flex-none text-right font-display text-23px font-600">
            {{ fmtMoney(it.amountCents) }}
          </div>
        </div>
      </div>
      <div class="flex items-baseline justify-between px-24px py-18px border-t-2 border-borderSoft bg-panel">
        <span class="text-21px font-800">TOTAL</span>
        <span class="font-display text-42px font-700 text-terracotta">{{ fmtMoney(order.totalCents) }}</span>
      </div>
      <div class="px-24px py-16px border-t-2 border-borderSoft bg-panel rounded-b-24px flex flex-col gap-10px">
        <button class="btn-pay w-full h-58px text-20px" @click="print">🖨 Print receipt</button>
        <button
          v-if="canVoid"
          class="w-full h-52px rounded-16px border-2 border-[#d94b3d] bg-[#d94b3d] text-17px font-800 text-white cursor-pointer press"
          @click="pinOpen = true"
        >✕ Cancel this sale (PIN)</button>
      </div>
    </div>
  </div>

  <PinDialog
    :open="pinOpen"
    :title="`Cancel sale #${order?.invNo} · ${fmtMoney(order?.totalCents ?? 0)} — enter PIN`"
    @ok="doVoid"
    @close="pinOpen = false"
  />
</template>
