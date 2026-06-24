<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { Company } from "@yf/core";
import { salesUnlocked, tryUnlock } from "../auth";
import { companies, currentCompany, setCompany } from "../place";
import { from, todayStr, dateLabel, setToday } from "../salesDate";
import DatePicker from "./DatePicker.vue";

const props = defineProps<{ mode: "till" | "sales" | "admin" | "report" }>();

const router = useRouter();
// Static date shown (same pill design) on the Menu/Admin pages where the date
// isn't selectable.
const todayLabel = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Left nav button: Menu opens the report (gated); the other pages go to Menu.
function goLeft(): void {
  if (props.mode === "till") openSales();
  else router.push("/");
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

// Passcode gate for the Sales report.
const passOpen = ref(false);
const passInput = ref("");
const passErr = ref(false);

function openSales() {
  if (salesUnlocked.value) {
    router.push("/sales");
    return;
  }
  passInput.value = "";
  passErr.value = false;
  passOpen.value = true;
}

function submitPass() {
  if (tryUnlock(passInput.value)) {
    passOpen.value = false;
    router.push("/sales");
  } else {
    passErr.value = true;
    passInput.value = "";
  }
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
        <template v-if="mode === 'till'">Report ›</template>
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
      <!-- Items + Report live behind the (gated) Sales area. -->
      <button
        v-if="mode === 'sales'"
        class="press flex items-center h-54px px-18px rounded-14px border-2 border-border bg-panel text-16px font-800 text-muted cursor-pointer"
        @click="router.push('/report')"
      >
        📊 Report
      </button>
      <button
        v-if="mode === 'sales'"
        class="press flex items-center h-54px px-18px rounded-14px border-2 border-border bg-panel text-16px font-800 text-muted cursor-pointer"
        @click="router.push('/admin')"
      >
        ⚙ Items
      </button>
      <!-- sales/report: clickable date selector; till/admin: today's date -->
      <div v-if="mode === 'sales' || mode === 'report'" class="relative">
        <button
          class="press flex items-center gap-9px h-54px px-20px rounded-14px bg-ink text-white text-17px font-800 cursor-pointer"
          @click="dateOpen = !dateOpen"
        >
          {{ dateLabel }}
          <span class="text-14px opacity-80" :class="dateOpen ? 'rotate-180' : ''">▾</span>
        </button>
        <template v-if="dateOpen">
          <div class="fixed inset-0 z-40" @click="dateOpen = false" />
          <div
            class="absolute top-full right-0 mt-6px z-50 bg-surface border-2 border-border rounded-18px shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-8px"
          >
            <DatePicker :model-value="from" :max="todayStr" @update:model-value="pickDate" />
            <button
              class="w-full h-42px text-14px mt-4px rounded-12px border-none bg-ink text-white font-800 cursor-pointer press"
              @click="((setToday()), (dateOpen = false))"
            >Today</button>
          </div>
        </template>
      </div>
      <div
        v-else
        class="flex items-center h-54px px-20px rounded-14px bg-ink text-white text-17px font-800"
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

  <!-- passcode modal -->
  <div
    v-if="passOpen"
    class="fixed inset-0 z-100 flex items-center justify-center bg-black/35 px-20px"
    @click.self="passOpen = false"
  >
    <div class="w-full max-w-360px bg-surface border-2 border-border rounded-22px p-24px">
      <div class="text-22px font-800 text-ink mb-4px">Manager passcode</div>
      <div class="text-15px font-700 text-muted mb-16px">Enter the passcode to open Sales.</div>
      <input
        v-model="passInput"
        type="password"
        inputmode="numeric"
        autofocus
        class="w-full h-58px px-18px rounded-14px border-2 text-24px font-800 text-center tracking-widest bg-tile outline-none"
        :class="passErr ? 'border-[#d94b3d]' : 'border-border'"
        placeholder="••••"
        @keyup.enter="submitPass"
      />
      <div v-if="passErr" class="text-14px font-800 text-[#d94b3d] mt-8px">Wrong passcode.</div>
      <div class="flex gap-12px mt-20px">
        <button
          class="press flex-1 h-54px rounded-14px border-2 border-border bg-panel text-18px font-800 text-muted cursor-pointer"
          @click="passOpen = false"
        >
          Cancel
        </button>
        <button
          class="press flex-1 h-54px rounded-14px border-none bg-olive text-18px font-800 text-white cursor-pointer"
          @click="submitPass"
        >
          Open
        </button>
      </div>
    </div>
  </div>
</template>
