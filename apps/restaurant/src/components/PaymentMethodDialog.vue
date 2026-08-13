<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import { YfDialog, YfNumberPad } from "@yf/ui";
import { money } from "../domain/restaurant";
import type { PaymentMethod } from "../domain/types";

const props = defineProps<{ open: boolean; totalCents: number }>();
const emit = defineEmits<{ confirm: [method: PaymentMethod, receivedCents?: number]; close: [] }>();
const changeOpen = shallowRef(false);
const receivedCents = shallowRef(0);
const error = shallowRef("");
const change = computed(() => Math.max(0, receivedCents.value - props.totalCents));
watch(() => props.open, (open) => { if (open) { receivedCents.value = 0; error.value = ""; } });
function cashReceived(value: number): void { receivedCents.value = Math.round(value * 100); changeOpen.value = false; if (receivedCents.value < props.totalCents) { error.value = "Cash received is less than the amount to pay."; return; } error.value = ""; emit("confirm", "cash", receivedCents.value); }
</script>

<template>
  <YfDialog :open="open" title="Payment" width="600px" :layer="110" :close-on-backdrop="false" @close="$emit('close')">
    <div class="px-28px py-24px text-center border-b-2 border-borderSoft"><span class="block text-16px font-900 text-muted uppercase tracking-wide">Amount to pay</span><strong class="block mt-4px font-display text-56px text-terracotta">{{ money(totalCents) }}</strong></div>
    <div class="p-26px flex flex-col gap-14px">
      <h3 class="m-0 text-center text-20px">Choose payment method</h3>
      <div class="flex gap-12px"><button class="yf-card-button flex-1 min-h-94px px-20px flex items-center gap-18px text-left" @click="$emit('confirm', 'cash', totalCents)"><span class="w-54px h-54px rounded-15px bg-successSoft grid place-items-center text-28px" aria-hidden="true">💵</span><strong class="text-25px">CASH</strong></button><button class="yf-card-button w-112px flex-none flex flex-col items-center justify-center gap-3px" aria-label="Calculate cash change" @click="changeOpen = true"><span class="text-28px" aria-hidden="true">🧮</span><strong class="text-13px">CHANGE</strong></button></div>
      <button class="yf-card-button min-h-94px px-20px flex items-center gap-18px text-left" @click="$emit('confirm', 'bank')"><span class="w-54px h-54px rounded-15px bg-[#dcebf0] grid place-items-center text-28px" aria-hidden="true">🏦</span><strong class="text-25px">BANK</strong></button>
      <button class="yf-card-button min-h-94px px-20px flex items-center gap-18px text-left" @click="$emit('confirm', 'qr')"><span class="w-54px h-54px rounded-15px bg-dangerSoft grid place-items-center text-28px" aria-hidden="true">▦</span><strong class="text-25px">QR</strong></button>
      <p v-if="error" class="m-0 px-14px py-10px rounded-12px bg-dangerSoft text-danger font-900" role="alert">{{ error }}</p>
      <div v-if="receivedCents >= totalCents && receivedCents" class="flex justify-between text-17px font-900"><span>Change</span><span>{{ money(change) }}</span></div>
    </div>
    <template #footer><button class="yf-btn w-full" @click="$emit('close')">Cancel</button></template>
  </YfDialog>
  <YfNumberPad :open="changeOpen" title="Cash received" :initial="totalCents / 100" money :layer="120" @confirm="cashReceived" @close="changeOpen = false" />
</template>
