<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";
import DatePicker from "./DatePicker.vue";
import Loading from "./Loading.vue";
import { getRepo } from "../db";
import { currentCompany } from "../place";
import { emailConfigured } from "../settings";
import { buildDailyExcelB64, dailyEmailBody, dailyEmailSubject } from "../report/daily";

// Pick a date and email its report to HQ, on demand (Close Day already sends
// the daily one automatically). The email is queued in the outbox; the
// Electron main process sends it and retries while offline.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const today = (): string => dayjs().format("YYYY-MM-DD");
const date = ref(today());
const calOpen = ref(false);
const status = ref<"idle" | "loading" | "success" | "queued" | "error">("idle");
const note = ref("");

// Default to today and a clean state every time the dialog opens.
watch(
  () => props.open,
  (o) => {
    if (o) {
      date.value = today();
      calOpen.value = false;
      status.value = "idle";
      note.value = "";
    }
  },
);

function pick(v: string): void {
  date.value = v;
  calOpen.value = false;
}

async function send(): Promise<void> {
  status.value = "loading";
  try {
    if (!(await emailConfigured())) {
      status.value = "error";
      note.value = "Email is not set up yet — add the HQ emails in Items → Settings, and SMTP_USER/SMTP_PASS to the till's .env file.";
      return;
    }
    const repo = await getRepo();
    const company = currentCompany.value;
    const orders = await repo.listOrdersByBusinessDate(date.value, date.value, company.id);
    const catalog = await repo.listItems(true);
    const credits = await repo.listCredits(company.id, { outstandingOnly: true });
    await repo.queueEmail({
      companyId: company.id,
      businessDate: date.value,
      subject: dailyEmailSubject(company.name, date.value, false),
      body: dailyEmailBody(company.name, date.value, orders, false),
      attachmentName: `${company.name.replace(/\s+/g, "-")}-sales-${date.value}.xlsx`,
      attachmentB64: buildDailyExcelB64(orders, catalog, credits),
    });

    // Try to send right now; if offline the outbox keeps retrying by itself.
    const result = await window.mailer?.process();
    if (result && result.sent > 0 && result.pending === 0) {
      status.value = "success";
      await new Promise((r) => setTimeout(r, 1300));
      emit("close");
    } else {
      status.value = "queued";
      note.value = result?.lastError
        ? "Could not send right now — it will keep trying automatically."
        : "No connection to the mail server — the report is saved and will send automatically when internet is back.";
    }
  } catch (e) {
    status.value = "error";
    note.value = e instanceof Error ? e.message : "Something went wrong.";
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="status !== 'loading' && $emit('close')"
  >
    <div
      class="w-380px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col overflow-auto"
      style="max-height: 92vh"
    >
      <template v-if="status === 'idle'">
        <div class="px-24px pt-22px pb-14px border-b-2 border-borderSoft flex-none">
          <div class="text-18px font-800 text-ink">Send report</div>
          <div class="text-14px font-700 text-muted">Email the day's sales to HQ.</div>
        </div>

        <div class="p-16px flex flex-col gap-10px">
          <div class="text-13px font-700 text-muted">Date</div>
          <!-- collapsed field; tap to expand the calendar -->
          <button
            class="h-52px px-16px rounded-14px border-2 border-border bg-white text-17px font-800 text-ink flex items-center justify-between cursor-pointer press hover:border-olive"
            @click="calOpen = !calOpen"
          >
            <span>{{ dayjs(date).format("DD MMM YYYY") }}</span>
            <span class="text-14px text-muted" :class="calOpen ? 'rotate-180' : ''">▾</span>
          </button>
          <div v-if="calOpen" class="flex justify-center">
            <DatePicker :model-value="date" @update:model-value="pick" />
          </div>
        </div>

        <div class="px-16px py-16px grid grid-cols-2 gap-12px border-t-2 border-borderSoft flex-none">
          <button
            class="h-54px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer press"
            @click="$emit('close')"
          >Cancel</button>
          <button class="btn-pay h-54px text-20px" @click="send">Send</button>
        </div>
      </template>

      <Loading
        v-else-if="status === 'loading' || status === 'success'"
        :state="status"
        :message="status === 'success' ? 'Report sent to HQ!' : 'Sending report…'"
      />

      <template v-else>
        <div class="flex flex-col items-center gap-14px px-24px py-30px text-center">
          <div class="text-44px">{{ status === "queued" ? "📮" : "⚠️" }}</div>
          <div class="text-19px font-800">{{ status === "queued" ? "Saved — will send later" : "Could not send" }}</div>
          <div class="text-15px font-700 text-muted">{{ note }}</div>
          <button class="btn-pay h-52px px-30px text-18px" @click="$emit('close')">OK</button>
        </div>
      </template>
    </div>
  </div>
</template>
