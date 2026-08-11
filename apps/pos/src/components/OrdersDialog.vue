<script setup lang="ts">
import { fmtMoney, type Order } from "@yf/core";
import { PAYMENT_UI } from "../payments";

defineProps<{ title: string | null; orders: Order[] }>();
defineEmits<{ close: []; select: [order: Order] }>();

const timeStr = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
const dateStr = (ts: number) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const itemsStr = (o: Order) => `${o.items.length} ${o.items.length === 1 ? "item" : "items"}`;
</script>

<template>
  <div
    v-if="title != null"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-60"
    @click.self="$emit('close')"
  >
    <div class="w-620px max-w-full max-h-86vh overflow-auto bg-surface rounded-24px shadow-[0_22px_64px_rgba(0,0,0,.32)]">
      <div class="flex items-center justify-between px-24px py-22px border-b-2 border-borderSoft sticky top-0 bg-surface">
        <div class="text-23px font-800">{{ title }}</div>
        <button
          class="w-48px h-48px rounded-full border-none bg-[#f0e7d6] text-19px font-800 text-muted cursor-pointer"
          @click="$emit('close')"
        >✕</button>
      </div>

      <div v-if="orders.length" class="px-24px py-18px flex flex-col gap-12px">
        <div class="flex bg-tile border-2 border-borderSoft rounded-18px overflow-hidden text-center">
          <div class="flex-1 px-20px py-14px">
            <div class="text-13px font-800 text-muted uppercase tracking-wide mb-3px">Sales</div>
            <div class="font-display text-34px font-700 text-olive leading-tight">{{ orders.length }}</div>
          </div>
          <div class="w-2px bg-borderSoft flex-none" />
          <div class="flex-1 px-20px py-14px">
            <div class="text-13px font-800 text-muted uppercase tracking-wide mb-3px">Total</div>
            <div class="font-display text-34px font-700 text-terracotta leading-tight">
              {{ fmtMoney(orders.reduce((a, o) => a + (o.voidedAt != null ? 0 : o.totalCents), 0)) }}
            </div>
          </div>
        </div>
        <button
          v-for="o in orders"
          :key="o.id"
          class="flex items-center gap-10px px-18px py-14px bg-tile border-2 border-borderSoft rounded-14px cursor-pointer text-left w-full transition-transform active:translate-y-2px"
          @click="$emit('select', o)"
        >
          <span class="text-15px font-800 text-faint min-w-72px">#{{ o.invNo }}</span>
          <span class="text-16px font-800 text-muted whitespace-nowrap">{{ dateStr(o.ts) }} · {{ timeStr(o.ts) }}</span>
          <span class="flex-1">
            <span class="inline-flex items-center px-10px py-4px rounded-full bg-[#e6edef] border-2 border-[#cfe0e4] text-13px font-800 text-[#3f7c8c] whitespace-nowrap">{{ itemsStr(o) }}</span>
          </span>          <span
            v-if="o.voidedAt != null"
            class="inline-flex items-center px-12px py-5px rounded-full bg-[#f8dcd8] text-14px font-900 tracking-wide text-[#d94b3d]"
          >CANCELLED</span>
          <span
            class="inline-flex items-center px-12px py-5px rounded-full text-14px font-800 tracking-wide"
            :style="{ color: PAYMENT_UI[o.method].color, background: PAYMENT_UI[o.method].tint }"
          >{{ PAYMENT_UI[o.method].label }}</span>
          <span
            class="font-display text-24px font-600 min-w-104px text-right"
            :class="o.voidedAt != null ? 'line-through opacity-50' : ''"
          >{{ fmtMoney(o.totalCents) }}</span>
          <span class="text-24px text-faint">›</span>
        </button>
      </div>
      <div v-else class="py-40px text-center text-17px font-700 text-faint">No matching orders.</div>
    </div>
  </div>
</template>
