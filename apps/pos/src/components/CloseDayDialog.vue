<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { computeStats, fmtMoney, localDateStr, type DayClose, type Order } from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";
import { getTodayClose, performClose, performReopen, type DailyReportDelivery } from "../business";
import { refreshBusinessDate } from "../salesDate";
import PinDialog from "./PinDialog.vue";
import Loading from "./Loading.vue";

// The one daily ritual: Close Day. Shows today's summary, closes on confirm
// (prints the day report + queues the HQ email), and — if today is already
// closed — offers a PIN-gated Reopen.

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; closed: [businessDate: string] }>();

const today = ref("");
const orders = ref<Order[]>([]);
const closedAs = ref<DayClose | null>(null);
const step = ref<"summary" | "confirm" | "working" | "done">("summary");
const pinOpen = ref(false);
const delivery = shallowRef<DailyReportDelivery | null>(null);

const stats = computed(() => computeStats(orders.value, "today"));

async function load(): Promise<void> {
  const repo = await getRepo();
  today.value = localDateStr(Date.now());
  const [dayClose, dayOrders, outbox] = await Promise.all([
    getTodayClose(currentCompany.value.id),
    repo.listOrdersByBusinessDate(today.value, today.value, currentCompany.value.id),
    repo.listOutbox(today.value),
  ]);
  closedAs.value = dayClose;
  orders.value = dayOrders;
  const report = outbox.find(
    (row) =>
      row.companyId === currentCompany.value.id &&
      row.attachmentName?.endsWith(`-close-day-${today.value}.xlsx`),
  );
  delivery.value = report ? (report.sentAt != null ? "sent" : "queued") : null;
  step.value = "summary";
}

watch(
  () => props.open,
  (o) => {
    if (o) void load();
  },
);

async function confirmClose(): Promise<void> {
  step.value = "working";
  try {
    const result = await performClose(today.value, {
      companyId: currentCompany.value.id,
      companyName: currentCompany.value.name,
      print: true,
    });
    delivery.value = result.delivery;
    step.value = "done";
    await new Promise((r) => setTimeout(r, 1200));
    emit("closed", today.value);
  } catch {
    // e.g. closed from another window in between — just re-sync.
    await load();
  }
}

async function retryReport(): Promise<void> {
  step.value = "working";
  try {
    const result = await performClose(today.value, {
      companyId: currentCompany.value.id,
      companyName: currentCompany.value.name,
      print: false,
    });
    delivery.value = result.delivery;
    step.value = "done";
    await new Promise((resolve) => setTimeout(resolve, 1200));
    emit("closed", today.value);
  } catch {
    await load();
  }
}

const doneMessage = computed(() =>
  delivery.value === "sent"
    ? "Day closed — report sent to HQ"
    : "Day closed — report saved and queued for retry",
);

async function reopen(): Promise<void> {
  pinOpen.value = false;
  await performReopen(currentCompany.value.id);
  // Sales count as today again — pull the date picker's ceiling back with them.
  await refreshBusinessDate();
  await load();
}

const closedAtText = computed(() =>
  closedAs.value
    ? new Date(closedAs.value.closedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "",
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="step !== 'working' && $emit('close')"
  >
    <div class="w-460px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] overflow-hidden">
      <template v-if="step === 'working' || step === 'done'">
        <Loading
          :state="step === 'done' ? 'success' : 'loading'"
          :message="step === 'done' ? doneMessage : 'Closing the day…'"
        />
      </template>

      <!-- Today already closed: offer PIN-gated reopen. -->
      <template v-else-if="closedAs">
        <div class="px-26px pt-24px pb-18px border-b-2 border-borderSoft text-center">
          <div class="text-40px">✅</div>
          <div class="text-22px font-800 mt-6px">Day closed</div>
          <div class="text-15px font-700 text-muted mt-4px">
            {{ today }} was closed at {{ closedAtText }}{{ closedAs.auto ? " (auto)" : "" }}.<br />
            New sales now count toward tomorrow.
          </div>
          <div class="text-14px font-800 mt-9px" :class="delivery === 'sent' ? 'text-oliveDark' : 'text-terracotta'">
            {{ delivery === "sent" ? "HQ report sent." : delivery === "queued" ? "HQ report queued for automatic retry." : "HQ report is not queued yet." }}
          </div>
        </div>
        <div class="px-26px py-22px flex flex-col gap-12px">
          <button class="btn-pay h-56px text-19px" @click="$emit('close')">OK</button>
          <button
            class="h-52px rounded-16px border-2 border-border bg-white text-16px font-800 text-muted cursor-pointer press"
            @click="pinOpen = true"
          >Reopen day (PIN)</button>
          <button
            v-if="delivery !== 'sent'"
            class="h-52px rounded-16px border-2 border-olive bg-[#eef3e5] text-16px font-900 text-oliveDark cursor-pointer press"
            @click="retryReport"
          >{{ delivery === "queued" ? "Retry report now" : "Create and queue report" }}</button>
        </div>
      </template>

      <template v-else>
        <div class="px-26px pt-24px pb-16px border-b-2 border-borderSoft">
          <div class="text-22px font-800">Close Day</div>
          <div class="text-15px font-700 text-muted">{{ today }}</div>
        </div>

        <div class="px-26px py-18px flex flex-col gap-10px">
          <div class="flex bg-tile border-2 border-borderSoft rounded-18px overflow-hidden text-center">
            <div class="flex-1 px-16px py-14px">
              <div class="text-13px font-800 text-muted uppercase tracking-wide mb-3px">Sales</div>
              <div class="font-display text-32px font-700 text-olive leading-tight">{{ stats.count }}</div>
            </div>
            <div class="w-2px bg-borderSoft flex-none" />
            <div class="flex-1 px-16px py-14px">
              <div class="text-13px font-800 text-muted uppercase tracking-wide mb-3px">Total</div>
              <div class="font-display text-32px font-700 text-terracotta leading-tight">{{ fmtMoney(stats.totalCents) }}</div>
            </div>
          </div>

          <div v-if="step === 'confirm'" class="text-center text-16px font-800 text-[#b3541e] px-6px py-4px">
            Close today's sales?<br />
            <span class="text-14px font-700 text-muted">The report prints and is emailed to HQ. New sales will count as tomorrow.</span>
          </div>
        </div>

        <div class="px-26px pb-24px grid grid-cols-2 gap-12px">
          <button
            class="h-58px rounded-16px border-2 border-border bg-white text-17px font-800 text-muted cursor-pointer press"
            @click="step === 'confirm' ? (step = 'summary') : $emit('close')"
          >{{ step === "confirm" ? "Back" : "Cancel" }}</button>
          <button
            class="btn-pay h-58px text-19px"
            @click="step === 'confirm' ? confirmClose() : (step = 'confirm')"
          >{{ step === "confirm" ? "Yes, close day" : "Close Day" }}</button>
        </div>
      </template>
    </div>
  </div>

  <PinDialog :open="pinOpen" title="Reopen day — enter PIN" @ok="reopen" @close="pinOpen = false" />
</template>
