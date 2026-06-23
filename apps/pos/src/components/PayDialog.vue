<script setup lang="ts">
import { fmtMoney, PAYMENT_METHODS, type PaymentMethod } from "@yf/core";
import { PAYMENT_UI } from "../payments";

defineProps<{ open: boolean; totalCents: number }>();
defineEmits<{ confirm: [method: PaymentMethod]; close: [] }>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-80"
    @click.self="$emit('close')"
  >
    <div class="w-560px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] overflow-hidden">
      <div class="px-28px py-26px text-center border-b-2 border-borderSoft">
        <div class="text-17px font-800 text-muted uppercase tracking-wider">Amount to pay</div>
        <div class="font-display text-58px font-700 text-terracotta leading-tight">{{ fmtMoney(totalCents) }}</div>
      </div>
      <div class="px-28px py-24px flex flex-col gap-14px">
        <div class="text-18px font-800 text-center mb-2px">Choose payment method</div>
        <button
          v-for="m in PAYMENT_METHODS"
          :key="m"
          class="flex items-center gap-18px px-24px py-18px rounded-18px border-2 border-border bg-tile cursor-pointer text-left transition-transform active:translate-y-2px"
          @click="$emit('confirm', m)"
        >
          <span
            class="w-60px h-60px flex-none rounded-16px flex items-center justify-center text-30px"
            :style="{ background: PAYMENT_UI[m].tint }"
          >{{ PAYMENT_UI[m].icon }}</span>
          <span class="text-25px font-800 text-ink uppercase">{{ m }}</span>
        </button>
      </div>
      <div class="px-28px pb-26px">
        <button
          class="w-full h-56px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer"
          @click="$emit('close')"
        >Cancel</button>
      </div>
    </div>
  </div>
</template>
