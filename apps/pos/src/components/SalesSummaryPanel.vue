<script setup lang="ts">
import { fmtMoney, PAYMENT_METHODS, type PaymentMethod, type Stats } from "@yf/core";
import { PAYMENT_UI } from "../payments";

defineProps<{ title: string; stats: Stats }>();
defineEmits<{ inspectMethod: [method: PaymentMethod] }>();
</script>

<template>
  <div class="bg-surface border-2 border-border rounded-22px p-24px flex flex-col gap-18px">
    <div class="text-20px font-800">Total Receive — {{ title }}</div>

    <!-- Sales (count) + Received (money) share one card -->
    <div class="flex bg-tile border-2 border-borderSoft rounded-18px overflow-hidden">
      <div class="flex-1 px-20px py-16px">
        <div class="text-14px font-800 text-muted uppercase tracking-wide mb-4px">Sales</div>
        <div class="font-display text-44px font-700 text-olive leading-tight">
          {{ stats.count }}
        </div>
      </div>
      <div class="w-2px bg-borderSoft flex-none" />
      <div class="flex-1 px-20px py-16px">
        <div class="text-14px font-800 text-muted uppercase tracking-wide mb-4px">Received</div>
        <div class="font-display text-44px font-700 text-terracotta leading-tight">
          {{ fmtMoney(stats.totalCents) }}
        </div>
      </div>
    </div>

    <!-- per-method breakdown: method · sales count · amount -->
    <table class="w-full border-collapse">
      <thead>
        <tr class="text-12px font-800 text-faint uppercase tracking-wide">
          <th class="text-left font-800 pb-12px">Method</th>
          <th class="text-center font-800 pb-12px px-8px">Sales</th>
          <th class="text-right font-800 pb-12px px-8px">Amount</th>
          <th class="w-44px pb-12px" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in PAYMENT_METHODS" :key="m" class="border-t-2 border-borderSoft">
          <td class="py-12px pr-8px">
            <div class="flex items-center gap-14px min-w-0">
              <div
                class="w-48px h-48px flex-none rounded-14px flex items-center justify-center text-22px"
                :style="{ background: PAYMENT_UI[m].tint }"
              >
                {{ PAYMENT_UI[m].icon }}
              </div>
              <div class="text-16px font-800 uppercase tracking-wide truncate">{{ m }}</div>
            </div>
          </td>
          <td class="py-12px px-8px text-center text-20px font-800 text-ink whitespace-nowrap">
            {{ stats.byMethod[m].count }}
          </td>
          <td
            class="py-12px px-8px text-right font-display text-22px font-600 whitespace-nowrap"
            :style="{ color: PAYMENT_UI[m].color }"
          >
            {{ fmtMoney(stats.byMethod[m].totalCents) }}
          </td>
          <td class="py-12px text-right">
            <button
              class="press w-36px h-36px rounded-full border-2 border-border bg-tile text-15px text-muted cursor-pointer disabled:opacity-40"
              :disabled="!stats.byMethod[m].count"
              :title="`View ${m} orders`"
              @click="$emit('inspectMethod', m)"
            >🔍</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
