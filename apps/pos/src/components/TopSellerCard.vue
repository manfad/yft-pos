<script setup lang="ts">
import { computed, ref } from "vue";
import { aggregateItemSales, fmtMoney, fmtQty, type ItemSale, type Order } from "@yf/core";
import { imageCss } from "../productImage";

const props = withDefaults(defineProps<{ orders: Order[]; label: string; limit?: number }>(), {
  limit: 4,
});
defineEmits<{ inspectItem: [sale: ItemSale] }>();

const sales = computed(() => aggregateItemSales(props.orders));
const top = computed(() => sales.value.slice(0, props.limit));
const showAll = ref(false);
</script>

<template>
  <div class="bg-surface border-2 border-border rounded-22px p-24px flex flex-col">
    <div class="flex items-center justify-between mb-16px">
      <div class="text-20px font-800">Top Seller — {{ label }}</div>
      <button
        v-if="sales.length"
        class="pill-btn h-42px px-18px text-15px"
        @click="showAll = true"
      >View all</button>
    </div>

    <table v-if="top.length" class="w-full border-collapse">
      <thead>
        <tr class="text-12px font-800 text-faint uppercase tracking-wide">
          <th class="text-left font-800 pb-12px">Item</th>
          <th class="text-center font-800 pb-12px px-8px">Sales</th>
          <th class="text-right font-800 pb-12px px-8px">Amount</th>
          <th class="w-44px pb-12px" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="s in top"
          :key="(s.itemId ?? s.name) + s.unit"
          class="border-t-2 border-borderSoft"
        >
          <td class="py-12px pr-8px">
            <div class="flex items-center gap-14px min-w-0">
              <div
                class="w-52px h-52px flex-none rounded-16px"
                :style="{
                  backgroundColor: s.tint,
                  backgroundImage: imageCss(s.image),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }"
              />
              <div class="text-19px font-800 truncate">{{ s.name }}</div>
            </div>
          </td>
          <td class="py-12px px-8px text-center font-display text-22px font-700 text-ink whitespace-nowrap">
            {{ fmtQty(s.qtyMilli) }}
          </td>
          <td class="py-12px px-8px text-right font-display text-22px font-600 text-terracotta whitespace-nowrap">
            {{ fmtMoney(s.amountCents) }}
          </td>
          <td class="py-12px text-right">
            <button
              class="press w-36px h-36px rounded-full border-2 border-border bg-tile text-15px text-muted cursor-pointer"
              :title="`View orders with ${s.name}`"
              @click="$emit('inspectItem', s)"
            >🔍</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="py-30px text-center text-17px font-700 text-faint">No items sold yet.</div>
  </div>

  <!-- full breakdown -->
  <div
    v-if="showAll"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-70"
    @click.self="showAll = false"
  >
    <div class="w-560px max-w-full max-h-86vh overflow-auto bg-surface rounded-24px shadow-[0_22px_64px_rgba(0,0,0,.32)]">
      <div class="flex items-center justify-between px-24px py-22px border-b-2 border-borderSoft sticky top-0 bg-surface">
        <div>
          <div class="text-23px font-800">Items sold — {{ label }}</div>
          <div class="text-15px font-700 text-muted">{{ sales.length }} products</div>
        </div>
        <button
          class="w-48px h-48px rounded-full border-none bg-[#f0e7d6] text-19px font-800 text-muted cursor-pointer"
          @click="showAll = false"
        >✕</button>
      </div>
      <div class="px-24px py-18px">
        <div class="flex items-center gap-14px pb-10px text-12px font-800 text-faint uppercase tracking-wide">
          <div class="w-48px flex-none" />
          <div class="flex-1 min-w-0">Item</div>
          <div class="w-64px text-center">Sales</div>
          <div class="w-110px text-right">Amount</div>
        </div>
        <div
          v-for="s in sales"
          :key="(s.itemId ?? s.name) + s.unit"
          class="flex items-center gap-14px py-12px border-t-2 border-borderSoft"
        >
          <div
            class="w-48px h-48px flex-none rounded-full"
            :style="{
              backgroundColor: s.tint,
              backgroundImage: imageCss(s.image),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }"
          />
          <div class="flex-1 min-w-0 text-18px font-800 truncate">{{ s.name }}</div>
          <div class="w-64px text-center font-display text-22px font-700 text-ink">
            {{ fmtQty(s.qtyMilli) }}
          </div>
          <div class="w-110px text-right font-display text-23px font-600 text-terracotta">
            {{ fmtMoney(s.amountCents) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
