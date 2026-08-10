<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fmtMoney, type Credit, type Order } from "@yf/core";
import { getRepo } from "../db";
import { useUi } from "../stores/ui";
import CreditorDetailDialog from "./CreditorDetailDialog.vue";
import ReceiptDialog from "./ReceiptDialog.vue";

const props = defineProps<{ companyId: number }>();
const ui = useUi();

// All credits (paid + unpaid) for the company — the panel shows the outstanding
// ones; the detail dialog needs the full history per creditor.
const allCredits = ref<Credit[]>([]);
const selectedName = ref<string | null>(null);
const confirming = ref<string | null>(null); // creditor pending a "clear all" confirm
const detail = ref<Order | null>(null);

async function load(): Promise<void> {
  const repo = await getRepo();
  allCredits.value = await repo.listCredits(props.companyId);
}
onMounted(load);
watch(() => props.companyId, load);

// One row per creditor with an outstanding balance.
const rows = computed(() => {
  const map = new Map<string, { name: string; total: number }>();
  for (const c of allCredits.value) {
    if (c.clearedAt !== null) continue;
    const g = map.get(c.name) ?? { name: c.name, total: 0 };
    g.total += c.amountCents;
    map.set(c.name, g);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
});
const grandTotal = computed(() => rows.value.reduce((a, r) => a + r.total, 0));

// Every credit (paid + unpaid) for the open creditor, for the detail dialog.
const selectedCredits = computed(() =>
  selectedName.value == null
    ? []
    : allCredits.value.filter((c) => c.name === selectedName.value),
);

function open(name: string): void {
  selectedName.value = name;
}

async function payOne(creditId: number): Promise<void> {
  const repo = await getRepo();
  await repo.clearCredit(creditId, Date.now());
  await load();
  ui.showToast("Receipt marked paid");
}

async function payMonth(creditIds: number[]): Promise<void> {
  if (!creditIds.length) return;
  const repo = await getRepo();
  const now = Date.now();
  for (const id of creditIds) await repo.clearCredit(id, now);
  await load();
  ui.showToast(`Cleared ${creditIds.length} receipt${creditIds.length > 1 ? "s" : ""}`);
}

async function clearAll(name: string): Promise<void> {
  const repo = await getRepo();
  await repo.clearCreditsByName(name, Date.now(), props.companyId);
  confirming.value = null;
  await load();
  ui.showToast(`Cleared credit · ${name}`);
}

async function inspect(orderId: number): Promise<void> {
  const repo = await getRepo();
  detail.value = await repo.getOrder(orderId);
}
</script>

<template>
  <div
    class="bg-surface border-2 border-border rounded-22px p-24px flex flex-col gap-16px"
  >
    <div class="flex items-baseline justify-between">
      <div class="font-display text-26px font-700">Credit</div>
      <div
        v-if="grandTotal > 0"
        class="font-display text-20px font-800 text-terracotta whitespace-nowrap"
      >
        {{ fmtMoney(grandTotal) }}
      </div>
    </div>

    <div
      v-if="!rows.length"
      class="py-30px text-center text-16px font-700 text-faint"
    >
      No outstanding credits. 🎉
    </div>

    <div v-else class="flex flex-col gap-12px">
      <div
        v-for="r in rows"
        :key="r.name"
        class="flex items-center gap-12px py-13px px-16px border-2 border-border rounded-16px"
      >
        <!-- name + magnify open the creditor's receipts -->
        <div
          class="flex-1 min-w-0 flex items-center gap-12px cursor-pointer press"
          @click="open(r.name)"
        >
          <span
            class="w-40px h-40px flex-none rounded-full border-2 border-border flex items-center justify-center text-17px"
            >🔍</span
          >
          <span class="text-19px font-800 truncate">{{ r.name }}</span>
        </div>
        <span
          class="font-display text-18px font-800 text-ink whitespace-nowrap"
          >{{ fmtMoney(r.total) }}</span
        >

        <!-- clear-all (two-step to avoid an accidental settle) -->
        <template v-if="confirming === r.name">
          <button
            class="h-40px px-16px rounded-14px border-2 border-olive bg-olive text-white text-14px font-800 cursor-pointer press flex-none"
            @click="clearAll(r.name)"
          >
            Confirm
          </button>
          <button
            class="h-40px px-12px rounded-14px border-2 border-border bg-white text-14px font-800 text-muted cursor-pointer press flex-none"
            @click="confirming = null"
          >
            ✕
          </button>
        </template>
        <button
          v-else
          class="h-40px px-20px rounded-14px border-2 border-border bg-surface text-15px font-800 text-ink cursor-pointer press flex-none"
          title="Mark all of this creditor's receipts as paid"
          @click="confirming = r.name"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Dialogs are `fixed`, so nesting them keeps this component single-root
         (lets the w-full / lg:flex-1 class from the parent actually apply). -->
    <CreditorDetailDialog
      :open="selectedName !== null"
      :name="selectedName ?? ''"
      :credits="selectedCredits"
      @pay="payOne"
      @pay-month="payMonth"
      @inspect="inspect"
      @close="selectedName = null"
    />
    <ReceiptDialog :order="detail" @close="detail = null" />
  </div>
</template>
