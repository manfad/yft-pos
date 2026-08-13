<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import draggable from "vuedraggable";
import { money } from "../domain/restaurant";
import type { MenuItem } from "../domain/types";
import { useRestaurantStore } from "../stores/restaurant";
import MenuItemDialog from "./MenuItemDialog.vue";

const store = useRestaurantStore();
const showArchived = shallowRef(false);
const editing = ref<MenuItem | null>(null);
const dialogOpen = shallowRef(false);
const displayItems = ref<MenuItem[]>([]);
const sourceItems = computed(() => store.menuItems.filter((item) => showArchived.value || !item.archived));
watch(sourceItems, (items) => { displayItems.value = [...items]; }, { immediate: true });
function open(item: MenuItem | null): void { editing.value = item; dialogOpen.value = true; }
function save(item: Omit<MenuItem, "id" | "sortOrder"> & { id?: string }): void { store.upsertMenuItem(item); dialogOpen.value = false; }
function reordered(): void { const shown = displayItems.value.map((item) => item.id); const hidden = store.menuItems.filter((item) => !shown.includes(item.id)).map((item) => item.id); store.setMenuOrder([...shown, ...hidden]); }
</script>

<template>
  <section class="h-full flex flex-col gap-16px">
    <div class="flex-none flex items-center gap-14px"><div><h2 class="m-0 font-display text-27px">Menu items</h2><p class="m-0 mt-3px text-14px font-700 text-muted">Hold and drag a row to change the order shown to cashiers.</p></div><label class="ml-auto flex items-center gap-10px min-h-48px px-16px rounded-14px bg-panel border-2 border-border font-800 cursor-pointer"><input v-model="showArchived" type="checkbox" class="w-24px h-24px accent-olive" /> Show archived</label><button class="yf-btn-primary" @click="open(null)">+ Add menu item</button></div>
    <div class="flex-1 min-h-0 overflow-auto rounded-22px bg-surface border-2 border-border">
      <div class="sticky top-0 z-1 grid grid-cols-[56px_minmax(220px,1fr)_190px_150px_180px_100px] gap-12px px-18px py-14px bg-panel border-b-2 border-border text-13px font-900 text-muted uppercase"><span /><span>Item</span><span>Category</span><span>Price</span><span>Status</span><span class="text-right">Action</span></div>
      <draggable v-model="displayItems" item-key="id" :delay="120" :delay-on-touch-only="true" :animation="150" ghost-class="drag-ghost" @end="reordered">
        <template #item="{ element: item }">
          <div class="grid grid-cols-[56px_minmax(220px,1fr)_190px_150px_180px_100px] gap-12px items-center min-h-78px px-18px py-10px border-b border-borderSoft cursor-grab select-none" :class="item.archived ? 'opacity-55' : ''">
            <span class="text-25px text-faint" aria-hidden="true">⠿</span><strong class="text-18px">{{ item.name }}</strong><span class="font-800 text-muted">{{ item.category }}</span><span><strong>{{ money(item.priceCents) }}</strong><small v-if="item.pricingMode === 'variable'" class="block text-muted">Variable</small></span><div class="flex flex-wrap gap-5px"><span v-if="item.checkoutOnly" class="yf-chip bg-warm text-terracottaDark">Checkout</span><span class="yf-chip" :class="item.available ? 'bg-successSoft text-oliveDark' : 'bg-dangerSoft text-danger'">{{ item.available ? 'Available' : 'Hidden' }}</span></div><button class="yf-btn min-h-42px h-42px" @click.stop="open(item)">Edit</button>
          </div>
        </template>
      </draggable>
    </div>
  </section>
  <MenuItemDialog :open="dialogOpen" :item="editing" @save="save" @close="dialogOpen = false" />
</template>

<style scoped>.drag-ghost { opacity: .35; background: #f3ead3; }</style>
