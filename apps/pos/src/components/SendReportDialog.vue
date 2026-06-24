<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";
import DatePicker from "./DatePicker.vue";
import { useUi } from "../stores/ui";

// Pick a date and "send" the report for it. DEMO: no real email yet — it just
// confirms with a toast. Wire to the SMTP/export bridge later.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const ui = useUi();

const today = (): string => dayjs().format("YYYY-MM-DD");
const date = ref(today());

// Default to today every time the dialog opens.
watch(
  () => props.open,
  (o) => {
    if (o) date.value = today();
  },
);

function send(): void {
  ui.showToast(`Report for ${dayjs(date.value).format("DD MMM YYYY")} sent ✓`);
  emit("close");
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div class="bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col">
      <div class="px-24px pt-22px pb-14px border-b-2 border-borderSoft">
        <div class="text-18px font-800 text-ink">Send report</div>
        <div class="text-14px font-700 text-muted">Choose the date to send.</div>
      </div>

      <div class="p-16px flex justify-center">
        <DatePicker :model-value="date" @update:model-value="(v) => (date = v)" />
      </div>

      <div class="px-16px py-16px grid grid-cols-2 gap-12px border-t-2 border-borderSoft">
        <button
          class="h-54px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer press"
          @click="$emit('close')"
        >Cancel</button>
        <button class="btn-pay h-54px text-20px" @click="send">Send</button>
      </div>
    </div>
  </div>
</template>
