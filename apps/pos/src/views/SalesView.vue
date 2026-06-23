<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fmtMoney, type ItemSale, type Order, type PaymentMethod } from "@yf/core";
import TopBar from "../components/TopBar.vue";
import ReceiptDialog from "../components/ReceiptDialog.vue";
import OrdersDialog from "../components/OrdersDialog.vue";
import TopSellerCard from "../components/TopSellerCard.vue";
import SalesSummaryPanel from "../components/SalesSummaryPanel.vue";
import { useSales } from "../stores/sales";
import { PAYMENT_UI } from "../payments";
import { SHOW_MONTH_CHART } from "../config";
import {
  from,
  startMs,
  endMs,
  dateLabel,
  setDay,
  weekStartMs,
  weekEndMs,
  weekDays,
  weekLabel,
  isThisWeek,
  canWeekForward,
  weekShift,
  weekToCurrent,
  monthLabel,
  monthStartMs,
  monthYear,
  monthIndex,
  daysInMonth,
  monthMaxDay,
  monthTodayDate,
} from "../salesDate";
import dayjs from "dayjs";

const sales = useSales();
onMounted(() => void sales.load());

const tab = ref<"date" | "week" | "month">("date");
const detail = ref<Order | null>(null);

// Load the order set for the active tab's period. Everything derives from the
// shared `from` date, so picking a date re-scopes the Day / Weekly / Monthly view
// to that day's day / week / month.
function loadForTab(): void {
  if (tab.value === "date") void sales.loadRange(startMs.value, endMs.value);
  else if (tab.value === "week") void sales.loadRange(weekStartMs.value, weekEndMs.value);
  else void sales.loadMonth(new Date(monthStartMs.value));
}
watch([tab, from], loadForTab);

const rangeTx = computed(() => [...sales.rangeOrders].sort((a, b) => b.ts - a.ts));

// ----- By Date: hourly chart (7am–5pm, an order at 8:00–8:59 counts as hour 8) -----
const DAY_HOUR_START = 7;
const DAY_HOUR_END = 17;
const dayHourly = computed(() => {
  const isSelectedToday = from.value === dayjs().format("YYYY-MM-DD");
  const nowHour = new Date().getHours();
  const buckets = Array.from({ length: DAY_HOUR_END - DAY_HOUR_START + 1 }, (_, i) => {
    const hour = DAY_HOUR_START + i;
    return { hour, total: 0, count: 0, isNow: isSelectedToday && hour === nowHour };
  });
  for (const o of sales.rangeOrders) {
    const h = new Date(o.ts).getHours();
    if (h < DAY_HOUR_START || h > DAY_HOUR_END) continue;
    const b = buckets[h - DAY_HOUR_START]!;
    b.total += o.totalCents;
    b.count += 1;
  }
  return buckets;
});
const hourMax = computed(() => Math.max(1, ...dayHourly.value.map((x) => x.total)));
const hourBarH = (total: number) => Math.max(4, Math.round((total / hourMax.value) * 132));
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
const hourRange = (h: number) => {
  const hh = String(h).padStart(2, "0");
  return `${hh}:00 – ${hh}:59`;
};

// per-day sums within the selected week (rangeOrders holds that week on the week tab)
const weekDaily = computed(() =>
  weekDays.value.map((d) => {
    const s = d.valueOf();
    const e = d.add(1, "day").valueOf();
    const orders = sales.rangeOrders.filter((o) => o.ts >= s && o.ts < e);
    return {
      total: orders.reduce((a, o) => a + o.totalCents, 0),
      count: orders.length,
      day: d,
      isToday: d.isSame(dayjs(), "day"),
    };
  }),
);
const weekMax = computed(() => Math.max(1, ...weekDaily.value.map((x) => x.total)));
const weekBarH = (total: number) => Math.max(4, Math.round((total / weekMax.value) * 132));

function openDay(d: number): void {
  setDay(dayjs(from.value).date(d));
  tab.value = "date";
}

// Drill-down: a filtered set of orders shown in OrdersDialog.
const inspect = ref<{ title: string; orders: Order[] } | null>(null);
const periodOrders = computed(() => (tab.value === "month" ? sales.monthOrders : sales.rangeOrders));
const periodLabel = computed(() =>
  tab.value === "month" ? monthLabel.value : tab.value === "week" ? weekLabel.value : dateLabel.value,
);

function inspectMethod(m: PaymentMethod): void {
  inspect.value = {
    title: `${m} · ${periodLabel.value}`,
    orders: periodOrders.value.filter((o) => o.method === m),
  };
}
function inspectItem(s: ItemSale): void {
  inspect.value = {
    title: `${s.name} · ${periodLabel.value}`,
    orders: periodOrders.value.filter((o) =>
      o.items.some((li) =>
        s.itemId != null ? li.itemId === s.itemId : li.name === s.name && li.unit === s.unit,
      ),
    ),
  };
}
const dailySums = computed(() => {
  const sums = new Array<number>(daysInMonth.value + 1).fill(0);
  for (const o of sales.monthOrders) {
    const d = new Date(o.ts).getDate();
    sums[d] = (sums[d] ?? 0) + o.totalCents;
  }
  return sums;
});
const dailyCount = computed(() => {
  const c = new Array<number>(daysInMonth.value + 1).fill(0);
  for (const o of sales.monthOrders) {
    const d = new Date(o.ts).getDate();
    c[d] = (c[d] ?? 0) + 1;
  }
  return c;
});
const maxSum = computed(() => Math.max(1, ...dailySums.value));
const barH = (d: number) => Math.max(4, Math.round((dailySums.value[d]! / maxSum.value) * 132));
const barLabel = (d: number) => (d === 1 || d % 5 === 0 || d === monthTodayDate.value ? String(d) : "");
const dayLabel = (d: number) =>
  new Date(monthYear.value, monthIndex.value, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
const countStr = (n: number) => `${n} ${n === 1 ? "sale" : "sales"}`;

const monthTx = computed(() => [...sales.monthOrders].sort((a, b) => b.ts - a.ts));

const timeStr = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
const dateStr = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const itemsStr = (o: Order) => `${o.items.length} ${o.items.length === 1 ? "item" : "items"}`;
</script>

<template>
  <TopBar mode="sales" />

  <div class="flex-1 overflow-auto p-24px flex flex-col gap-22px">
    <!-- tabs -->
    <div class="flex gap-8px p-7px bg-[#e3d6bb] border-2 border-border rounded-16px self-start">
      <button
        class="px-26px py-12px rounded-12px border-none cursor-pointer text-17px font-800 transition-colors"
        :class="tab === 'date' ? 'bg-ink text-white shadow-[0_2px_0_rgba(0,0,0,0.18)]' : 'bg-surface text-muted'"
        @click="tab = 'date'"
      >Day</button>
      <button
        class="px-26px py-12px rounded-12px border-none cursor-pointer text-17px font-800 transition-colors"
        :class="tab === 'week' ? 'bg-ink text-white shadow-[0_2px_0_rgba(0,0,0,0.18)]' : 'bg-surface text-muted'"
        @click="tab = 'week'"
      >Weekly</button>
      <button
        class="px-26px py-12px rounded-12px border-none cursor-pointer text-17px font-800 transition-colors"
        :class="tab === 'month' ? 'bg-ink text-white shadow-[0_2px_0_rgba(0,0,0,0.18)]' : 'bg-surface text-muted'"
        @click="tab = 'month'"
      >Monthly</button>
    </div>

    <!-- ===== BY DATE ===== -->
    <div v-if="tab === 'date'" class="flex flex-col gap-22px">
      <!-- hourly chart -->
      <div class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="text-20px font-800 mb-18px">Hourly Sales — {{ dateLabel }}</div>
        <div class="flex items-end gap-8px h-170px">
          <div
            v-for="x in dayHourly"
            :key="x.hour"
            class="group relative flex-1 flex flex-col justify-end items-center gap-7px h-full"
          >
            <div
              class="pointer-events-none absolute bottom-full mb-8px left-1/2 -translate-x-1/2 z-20 hidden group-hover:block whitespace-nowrap rounded-12px bg-ink px-12px py-9px text-center shadow-[0_8px_24px_rgba(0,0,0,.22)]"
            >
              <div class="text-13px font-800 text-white">{{ hourRange(x.hour) }}</div>
              <div class="text-12px font-700 text-[#d7e0c6]">{{ countStr(x.count) }}</div>
              <div class="font-display text-18px font-700 text-[#f0c98a] leading-tight">
                {{ fmtMoney(x.total) }}
              </div>
            </div>
            <div
              class="w-full max-w-46px rounded-t-6px transition-opacity group-hover:opacity-80"
              :class="x.isNow ? 'bg-terracotta' : 'bg-chart'"
              :style="{ height: hourBarH(x.total) + 'px' }"
            />
            <div class="text-12px font-700 h-16px" :class="x.isNow ? 'text-terracotta' : 'text-faint'">
              {{ hourLabel(x.hour) }}
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-22px items-start">
        <SalesSummaryPanel :title="dateLabel" :stats="sales.rangeStats" @inspect-method="inspectMethod" />
        <TopSellerCard
          :orders="sales.rangeOrders"
          :label="dateLabel"
          :limit="4"
          @inspect-item="inspectItem"
        />
      </div>

      <div class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="text-20px font-800 mb-16px">
          Transactions — {{ periodLabel }}
        </div>
        <div v-if="rangeTx.length" class="flex flex-col gap-10px">
          <button
            v-for="o in rangeTx"
            :key="o.id"
            class="flex items-center gap-10px px-18px py-14px bg-tile border-2 border-borderSoft rounded-14px cursor-pointer text-left w-full transition-transform active:translate-y-2px"
            @click="detail = o"
          >
            <span class="text-15px font-800 text-faint min-w-44px">#{{ o.id }}</span>
            <span class="text-17px font-800 text-muted whitespace-nowrap">{{ dateStr(o.ts) }} · {{ timeStr(o.ts) }}</span>
            <span class="flex-1">
              <span class="inline-flex items-center px-10px py-4px rounded-full bg-[#e6edef] border-2 border-[#cfe0e4] text-13px font-800 text-[#3f7c8c] whitespace-nowrap">{{ itemsStr(o) }}</span>
            </span>
            <span
              class="inline-flex items-center px-12px py-5px rounded-full text-14px font-800 tracking-wide"
              :style="{ color: PAYMENT_UI[o.method].color, background: PAYMENT_UI[o.method].tint }"
            >{{ PAYMENT_UI[o.method].label }}</span>
            <span class="font-display text-25px font-600 min-w-104px text-right">{{ fmtMoney(o.totalCents) }}</span>
            <span class="text-24px text-faint">›</span>
          </button>
        </div>
        <div v-else class="py-30px text-center text-17px font-700 text-faint">No sales for this date.</div>
      </div>
    </div>

    <!-- ===== WEEKLY ===== -->
    <div v-else-if="tab === 'week'" class="flex flex-col gap-22px">
      <!-- week nav + daily chart -->
      <div class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="flex items-center justify-between mb-18px flex-wrap gap-10px">
          <div class="text-20px font-800">Daily Sales — {{ weekLabel }}</div>
          <div class="flex items-center gap-8px">
            <button class="pill-btn h-40px px-16px text-18px" title="Previous week" @click="weekShift(-1)">‹</button>
            <button
              class="pill-btn h-40px px-14px text-14px"
              :class="isThisWeek ? 'opacity-50' : ''"
              :disabled="isThisWeek"
              @click="weekToCurrent"
            >This week</button>
            <button
              class="pill-btn h-40px px-16px text-18px"
              :class="!canWeekForward ? 'opacity-50' : ''"
              :disabled="!canWeekForward"
              title="Next week"
              @click="weekShift(1)"
            >›</button>
          </div>
        </div>
        <div class="flex items-end gap-12px h-170px">
          <div
            v-for="x in weekDaily"
            :key="x.day.valueOf()"
            class="group relative flex-1 flex flex-col justify-end items-center gap-7px h-full"
          >
            <div
              class="pointer-events-none absolute bottom-full mb-8px left-1/2 -translate-x-1/2 z-20 hidden group-hover:block whitespace-nowrap rounded-12px bg-ink px-12px py-9px text-center shadow-[0_8px_24px_rgba(0,0,0,.22)]"
            >
              <div class="text-13px font-800 text-white">{{ x.day.format("ddd, DD MMM") }}</div>
              <div class="text-12px font-700 text-[#d7e0c6]">{{ countStr(x.count) }}</div>
              <div class="font-display text-18px font-700 text-[#f0c98a] leading-tight">
                {{ fmtMoney(x.total) }}
              </div>
            </div>
            <div
              class="w-full max-w-46px rounded-t-6px transition-opacity group-hover:opacity-80"
              :class="x.isToday ? 'bg-terracotta' : 'bg-chart'"
              :style="{ height: weekBarH(x.total) + 'px' }"
            />
            <div class="text-12px font-700 h-16px" :class="x.isToday ? 'text-terracotta' : 'text-faint'">
              {{ x.day.format("ddd") }}
            </div>
          </div>
        </div>
      </div>

      <!-- stat cards -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-22px items-start">
        <SalesSummaryPanel :title="weekLabel" :stats="sales.rangeStats" @inspect-method="inspectMethod" />
        <TopSellerCard
          :orders="sales.rangeOrders"
          :label="weekLabel"
          :limit="4"
          @inspect-item="inspectItem"
        />
      </div>

      <!-- transactions -->
      <div class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="text-20px font-800 mb-16px">
          Transactions — {{ periodLabel }}
        </div>
        <div v-if="rangeTx.length" class="flex flex-col gap-10px">
          <button
            v-for="o in rangeTx"
            :key="o.id"
            class="flex items-center gap-10px px-18px py-14px bg-tile border-2 border-borderSoft rounded-14px cursor-pointer text-left w-full transition-transform active:translate-y-2px"
            @click="detail = o"
          >
            <span class="text-15px font-800 text-faint min-w-44px">#{{ o.id }}</span>
            <span class="text-17px font-800 text-muted whitespace-nowrap">{{ dateStr(o.ts) }} · {{ timeStr(o.ts) }}</span>
            <span class="flex-1">
              <span class="inline-flex items-center px-10px py-4px rounded-full bg-[#e6edef] border-2 border-[#cfe0e4] text-13px font-800 text-[#3f7c8c] whitespace-nowrap">{{ itemsStr(o) }}</span>
            </span>
            <span
              class="inline-flex items-center px-12px py-5px rounded-full text-14px font-800 tracking-wide"
              :style="{ color: PAYMENT_UI[o.method].color, background: PAYMENT_UI[o.method].tint }"
            >{{ PAYMENT_UI[o.method].label }}</span>
            <span class="font-display text-25px font-600 min-w-104px text-right">{{ fmtMoney(o.totalCents) }}</span>
            <span class="text-24px text-faint">›</span>
          </button>
        </div>
        <div v-else class="py-30px text-center text-17px font-700 text-faint">No sales this week.</div>
      </div>
    </div>

    <!-- ===== MONTHLY ===== -->
    <div v-else class="flex flex-col gap-22px">
      <!-- chart first -->
      <div v-if="SHOW_MONTH_CHART" class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="text-20px font-800 mb-18px">Daily Sales — {{ monthLabel }}</div>
        <div class="flex items-end gap-4px h-170px">
          <div
            v-for="d in daysInMonth"
            :key="d"
            class="group relative flex-1 flex flex-col justify-end items-center gap-7px h-full"
          >
            <!-- hover tooltip: date · sales · earned -->
            <div
              class="pointer-events-none absolute bottom-full mb-8px left-1/2 -translate-x-1/2 z-20 hidden group-hover:block whitespace-nowrap rounded-12px bg-ink px-12px py-9px text-center shadow-[0_8px_24px_rgba(0,0,0,.22)]"
            >
              <div class="text-13px font-800 text-white">{{ dayLabel(d) }}</div>
              <div class="text-12px font-700 text-[#d7e0c6]">{{ countStr(dailyCount[d] ?? 0) }}</div>
              <div class="font-display text-18px font-700 text-[#f0c98a] leading-tight">
                {{ fmtMoney(dailySums[d] ?? 0) }}
              </div>
              <div v-if="d <= monthMaxDay" class="text-10px font-700 text-[#bcae93] mt-2px">tap to view</div>
            </div>
            <div
              class="w-full max-w-26px rounded-t-6px transition-opacity group-hover:opacity-80"
              :class="[d === monthTodayDate ? 'bg-terracotta' : 'bg-chart', d <= monthMaxDay ? 'cursor-pointer' : '']"
              :style="{ height: barH(d) + 'px' }"
              @click="d <= monthMaxDay && openDay(d)"
            />
            <div class="text-11px font-700 text-faint h-14px">{{ barLabel(d) }}</div>
          </div>
        </div>
      </div>

      <!-- stat cards below the chart -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-22px items-start">
        <SalesSummaryPanel :title="monthLabel" :stats="sales.monthStats" @inspect-method="inspectMethod" />
        <TopSellerCard
          :orders="sales.monthOrders"
          :label="monthLabel"
          :limit="4"
          @inspect-item="inspectItem"
        />
      </div>

      <div class="bg-surface border-2 border-border rounded-22px p-24px">
        <div class="text-20px font-800 mb-16px">
          Transactions — {{ periodLabel }}
        </div>
        <div v-if="monthTx.length" class="flex flex-col gap-10px">
          <button
            v-for="o in monthTx"
            :key="o.id"
            class="flex items-center gap-10px px-18px py-14px bg-tile border-2 border-borderSoft rounded-14px cursor-pointer text-left w-full transition-transform active:translate-y-2px"
            @click="detail = o"
          >
            <span class="text-15px font-800 text-faint min-w-44px">#{{ o.id }}</span>
            <span class="text-17px font-800 text-muted whitespace-nowrap">{{ dateStr(o.ts) }} · {{ timeStr(o.ts) }}</span>
            <span class="flex-1">
              <span class="inline-flex items-center px-10px py-4px rounded-full bg-[#e6edef] border-2 border-[#cfe0e4] text-13px font-800 text-[#3f7c8c] whitespace-nowrap">{{ itemsStr(o) }}</span>
            </span>
            <span
              class="inline-flex items-center px-12px py-5px rounded-full text-14px font-800 tracking-wide"
              :style="{ color: PAYMENT_UI[o.method].color, background: PAYMENT_UI[o.method].tint }"
            >{{ PAYMENT_UI[o.method].label }}</span>
            <span class="font-display text-25px font-600 min-w-104px text-right">{{ fmtMoney(o.totalCents) }}</span>
            <span class="text-24px text-faint">›</span>
          </button>
        </div>
        <div v-else class="py-30px text-center text-17px font-700 text-faint">No sales this month.</div>
      </div>
    </div>
  </div>

  <OrdersDialog
    :title="inspect?.title ?? null"
    :orders="inspect?.orders ?? []"
    @select="detail = $event"
    @close="inspect = null"
  />
  <ReceiptDialog :order="detail" @close="detail = null" />
</template>
