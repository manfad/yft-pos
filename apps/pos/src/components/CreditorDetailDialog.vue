<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fmtMoney, type Credit } from "@yf/core";
import dayjs from "dayjs";

const props = defineProps<{ open: boolean; name: string; credits: Credit[] }>();
const emit = defineEmits<{
  pay: [creditId: number];
  payMonth: [creditIds: number[]];
  inspect: [orderId: number];
  close: [];
}>();

// Outstanding receipt ids for a month group — the payload for a "pay month".
const monthOutstanding = (items: Credit[]): number[] =>
  items.filter((c) => c.clearedAt === null).map((c) => c.id);

// Group this creditor's receipts by month+year, newest month first.
const groups = computed(() => {
  const map = new Map<string, { key: string; label: string; items: Credit[]; outstanding: number }>();
  for (const c of props.credits) {
    const key = dayjs(c.date).format("YYYY-MM");
    let g = map.get(key);
    if (!g) {
      g = { key, label: dayjs(c.date).format("MMMM YYYY"), items: [], outstanding: 0 };
      map.set(key, g);
    }
    g.items.push(c);
    if (c.clearedAt === null) g.outstanding += c.amountCents;
  }
  for (const g of map.values()) g.items.sort((a, b) => b.date - a.date);
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
});
const outstanding = computed(() =>
  props.credits.reduce((a, c) => a + (c.clearedAt === null ? c.amountCents : 0), 0),
);

// Expand every month by default whenever the dialog (re)opens.
const expanded = ref<Set<string>>(new Set());
watch(
  () => [props.open, props.name] as const,
  ([o]) => {
    if (o) expanded.value = new Set(groups.value.map((g) => g.key));
  },
  { immediate: true },
);
function toggle(key: string): void {
  const next = new Set(expanded.value);
  next.has(key) ? next.delete(key) : next.add(key);
  expanded.value = next;
}

const fmtDay = (ts: number): string => dayjs(ts).format("DD MMM · h:mm a");
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-60"
    @click.self="$emit('close')"
  >
    <div class="w-560px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col" style="max-height: 92vh">
      <div class="px-26px py-20px border-b-2 border-borderSoft flex items-center justify-between flex-none">
        <div class="min-w-0">
          <div class="text-15px font-800 text-muted uppercase tracking-wider">Credit</div>
          <div class="text-26px font-800 truncate">{{ name }}</div>
        </div>
        <div class="text-right flex-none ml-12px">
          <div class="text-13px font-800 text-muted uppercase tracking-wide">Outstanding</div>
          <div class="font-display text-26px font-800" :class="outstanding > 0 ? 'text-terracotta' : 'text-olive'">
            {{ fmtMoney(outstanding) }}
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto px-20px py-18px flex flex-col gap-16px min-h-80px">
        <div v-for="g in groups" :key="g.key" class="flex flex-col gap-8px">
          <div class="flex items-center gap-10px px-16px py-12px rounded-14px border-2 border-border bg-tile">
            <div class="flex-1 min-w-0 flex items-center gap-10px cursor-pointer" @click="toggle(g.key)">
              <span class="text-13px text-muted flex-none">{{ expanded.has(g.key) ? "▾" : "▸" }}</span>
              <span class="text-16px font-800">{{ g.label }}</span>
              <span class="flex-1" />
              <span
                v-if="g.outstanding > 0"
                class="font-display text-20px font-800 whitespace-nowrap text-ink"
              >{{ fmtMoney(g.outstanding) }}</span>
              <span v-else class="text-14px font-800 whitespace-nowrap text-faint">all paid</span>
            </div>
            <!-- pay every outstanding receipt in this month at once -->
            <button
              v-if="g.outstanding > 0"
              class="h-38px px-18px rounded-full border-2 border-olive bg-olive text-white text-14px font-800 cursor-pointer press flex-none"
              title="Mark this month's receipts as paid"
              @click="$emit('payMonth', monthOutstanding(g.items))"
            >Pay</button>
          </div>

          <!-- the month's receipts grouped into one bordered card, inset under
               the header; rows are smaller than the month row above them -->
          <div
            v-if="expanded.has(g.key)"
            class="mx-10px px-18px py-6px rounded-14px border-2 border-border bg-surface flex flex-col"
          >
            <div
              v-for="c in g.items"
              :key="c.id"
              class="flex items-center gap-10px py-10px border-b-2 border-borderSoft last:border-b-0 transition-colors"
              :class="c.clearedAt !== null ? 'opacity-55' : ''"
            >
              <!-- click the receipt body to view its detail -->
              <div class="flex-1 min-w-0 flex items-center gap-8px cursor-pointer" @click="$emit('inspect', c.orderId)">
                <span class="text-13px font-800 text-faint flex-none">#{{ c.orderId }}</span>
                <span class="text-12px font-700 text-muted truncate">{{ fmtDay(c.date) }}</span>
                <span class="text-14px" title="View receipt">🔍</span>
              </div>
              <span class="font-display text-16px font-700 whitespace-nowrap">{{ fmtMoney(c.amountCents) }}</span>
              <button
                v-if="c.clearedAt === null"
                class="h-32px px-14px rounded-full border-2 border-olive bg-olive text-white text-13px font-800 cursor-pointer press flex-none"
                @click.stop="$emit('pay', c.id)"
              >Pay</button>
              <span
                v-else
                class="h-32px px-12px rounded-full bg-[#e3ecd6] text-olive text-12px font-800 flex items-center flex-none"
              >Paid</span>
            </div>
          </div>
        </div>
        <div v-if="!groups.length" class="py-30px text-center text-16px font-700 text-faint">No credits.</div>
      </div>

      <div class="px-22px py-18px border-t-2 border-borderSoft flex-none">
        <button
          class="w-full h-52px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer"
          @click="$emit('close')"
        >Close</button>
      </div>
    </div>
  </div>
</template>
