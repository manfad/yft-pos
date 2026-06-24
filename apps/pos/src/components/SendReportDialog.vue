<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";
import DatePicker from "./DatePicker.vue";
import Loading from "./Loading.vue";

// Pick a date and "send" the report for it. DEMO: the send is a simulated
// promise (spinner -> success check). Wire to the SMTP/export bridge later.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const today = (): string => dayjs().format("YYYY-MM-DD");
const date = ref(today());
const calOpen = ref(false);
const status = ref<"idle" | "loading" | "success">("idle");

// Default to today and a clean state every time the dialog opens.
watch(
  () => props.open,
  (o) => {
    if (o) {
      date.value = today();
      calOpen.value = false;
      status.value = "idle";
    }
  },
);

function pick(v: string): void {
  date.value = v;
  calOpen.value = false;
}

async function send(): Promise<void> {
  status.value = "loading";
  // DEMO: pretend to email the report for the chosen date.
  await new Promise((r) => setTimeout(r, 1500));
  status.value = "success";
  await new Promise((r) => setTimeout(r, 1300));
  emit("close");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="status === 'idle' && $emit('close')"
  >
    <div
      class="w-380px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col overflow-auto"
      style="max-height: 92vh"
    >
      <template v-if="status === 'idle'">
        <div class="px-24px pt-22px pb-14px border-b-2 border-borderSoft flex-none">
          <div class="text-18px font-800 text-ink">Send report</div>
          <div class="text-14px font-700 text-muted">Choose the date to send.</div>
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
        v-else
        :state="status"
        :message="status === 'success' ? 'Report sent successfully!' : 'Sending report…'"
      />
    </div>
  </div>
</template>
