<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import type { Company } from "@yf/core";
import { companies, currentCompany, setCompany } from "../place";
import { from, todayStr, dateLabel, setToday, setDay } from "../salesDate";
import DatePicker from "./DatePicker.vue";
import SendReportDialog from "./SendReportDialog.vue";
import CloseDayDialog from "./CloseDayDialog.vue";

const props = defineProps<{ mode: "till" | "sales" | "admin" | "report" }>();

const router = useRouter();
// Today's date shown (same pill design) on the Menu/Admin pages where the date
// isn't selectable. Derived from the ticking clock so it rolls over at midnight.
const todayLabel = computed(() => dayjs(todayStr.value).format("DD MMM YYYY"));

// Left nav (back) button targets per page:
//   Menu (/)        → Dashboard (gated)
//   Dashboard, Item → Menu (/)
//   Report          → Dashboard
function goLeft(): void {
  if (props.mode === "till" || props.mode === "report") router.push("/dashboard");
  else router.push("/");
}

// Send-report dialog (report mode).
const sendOpen = ref(false);

// Close Day — the daily ritual, reachable from the till.
const closeDayOpen = ref(false);
function onDayClosed(businessDate: string): void {
  closeDayOpen.value = false;
  // Land the cashier on the just-closed day's report (client takes a copy daily).
  setDay(businessDate);
  void router.push("/report");
}

// Company switcher popover.
const placeOpen = ref(false);
function pickCompany(c: Company) {
  setCompany(c);
  placeOpen.value = false;
}

// Date picker popover (sales mode) — drives the Sales report selection.
const dateOpen = ref(false);
function pickDate(v: string) {
  from.value = v;
  dateOpen.value = false;
}

</script>

<template>
  <div
    class="flex items-center justify-between gap-16px px-22px py-14px bg-surface border-b-2 border-border flex-none relative"
  >
    <!-- left: Menu opens the (gated) report; Report/Admin go back to Menu -->
    <div class="flex items-center gap-16px">
      <button
        class="press flex items-center gap-9px h-54px px-24px rounded-14px border-2 border-border bg-panel text-18px font-800 text-ink cursor-pointer"
        @click="goLeft"
      >
        <template v-if="mode === 'till'">Dashboard ›</template>
        <template v-else-if="mode === 'report'">‹ Dashboard</template>
        <template v-else>‹ Menu</template>
      </button>
    </div>

    <!-- middle: place name + switcher -->
    <div class="flex flex-col items-center leading-tight">
      <button
        class="press flex items-center gap-7px bg-transparent border-none cursor-pointer text-23px font-800 text-ink"
        @click="placeOpen = !placeOpen"
      >
        {{ currentCompany.name }}
        <span class="text-16px text-muted" :class="placeOpen ? 'rotate-180' : ''">▾</span>
      </button>
    </div>

    <!-- right -->
    <div class="flex items-center gap-12px">
      <!-- till: the Close Day ritual -->
      <button
        v-if="mode === 'till'"
        class="press flex items-center h-54px px-20px rounded-14px border-2 border-[#b3541e] bg-[#f6e3d3] text-17px font-800 text-[#b3541e] cursor-pointer"
        @click="closeDayOpen = true"
      >
        Close Day
      </button>
      <!-- Items + Report live behind the (gated) Sales area. -->
      <button
        v-if="mode === 'sales'"
        class="press flex items-center h-54px px-18px rounded-14px border-2 border-border bg-panel text-16px font-800 text-muted cursor-pointer"
        @click="router.push('/report')"
      >
        Report
      </button>
      <button
        v-if="mode === 'sales'"
        class="press flex items-center h-54px px-18px rounded-14px border-2 border-border bg-panel text-16px font-800 text-muted cursor-pointer"
        @click="router.push('/item')"
      >
        Items
      </button>
      <!-- report: send the report by email (demo) -->
      <button
        v-if="mode === 'report'"
        class="press flex items-center h-54px px-18px rounded-14px border-2 border-border bg-panel text-16px font-800 text-muted cursor-pointer"
        @click="sendOpen = true"
      >
        Send
      </button>
      <!-- sales/report: clickable date selector; till/admin: today's date -->
      <div v-if="mode === 'sales' || mode === 'report'" class="relative">
        <button
          class="press flex items-center w-172px h-54px px-14px rounded-14px bg-date text-white text-17px font-800 cursor-pointer"
          @click="dateOpen = !dateOpen"
        >
          <span class="flex-1 text-center whitespace-nowrap">{{ dateLabel }}</span>
          <span class="w-12px flex-none text-center text-14px opacity-80" :class="dateOpen ? 'rotate-180' : ''">▾</span>
        </button>
        <template v-if="dateOpen">
          <div class="fixed inset-0 z-40" @click="dateOpen = false" />
          <div
            class="absolute top-full right-0 mt-6px z-50 bg-surface border-2 border-border rounded-18px shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-8px"
          >
            <DatePicker :model-value="from" :max="todayStr" @update:model-value="pickDate" />
            <button
              class="w-full h-42px text-14px mt-4px rounded-12px border-none bg-oliveDark text-white font-800 cursor-pointer press"
              @click="((setToday()), (dateOpen = false))"
            >Today</button>
          </div>
        </template>
      </div>
      <div
        v-else
        class="flex items-center justify-center w-172px h-54px px-14px rounded-14px bg-date text-white text-17px font-800 whitespace-nowrap"
      >
        {{ todayLabel }}
      </div>
    </div>

    <!-- place popover -->
    <template v-if="placeOpen">
      <div class="fixed inset-0 z-40" @click="placeOpen = false" />
      <div
        class="absolute top-full left-1/2 -translate-x-1/2 mt-6px z-50 min-w-220px bg-surface border-2 border-border rounded-16px shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-6px"
      >
        <button
          v-for="c in companies"
          :key="c.id"
          class="press w-full flex items-center justify-between gap-10px text-left px-14px py-12px rounded-12px text-18px font-800 cursor-pointer border-none bg-transparent"
          :class="c.id === currentCompany.id ? 'bg-panel text-ink' : 'text-muted'"
          @click="pickCompany(c)"
        >
          <span>{{ c.name }}</span>
          <span
            v-if="c.id === currentCompany.id"
            class="flex-none rounded-full bg-olive text-white text-12px font-900 px-10px py-3px"
          >Now</span>
        </button>
      </div>
    </template>
  </div>

  <SendReportDialog :open="sendOpen" @close="sendOpen = false" />
  <CloseDayDialog :open="closeDayOpen" @closed="onDayClosed" @close="closeDayOpen = false" />
</template>
