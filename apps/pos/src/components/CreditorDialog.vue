<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { fmtMoney } from "@yf/core";
import TextInput from "./TextInput.vue";

const props = defineProps<{ open: boolean; totalCents: number; names: string[] }>();
const emit = defineEmits<{ confirm: [name: string]; close: [] }>();

const newName = ref("");
// Filter the previous-creditor list as the cashier types a new/partial name.
const filtered = computed(() => {
  const q = newName.value.trim().toLowerCase();
  const list = props.names;
  return q ? list.filter((n) => n.toLowerCase().includes(q)) : list;
});
const canAdd = computed(() => newName.value.trim().length > 0);

// Reset the typed name each time the dialog opens.
watch(
  () => props.open,
  (o) => {
    if (o) newName.value = "";
  },
);

function pick(name: string): void {
  emit("confirm", name);
}
function addNew(): void {
  if (canAdd.value) emit("confirm", newName.value.trim());
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div class="w-520px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col" style="max-height: 92vh">
      <div class="px-28px py-22px text-center border-b-2 border-borderSoft flex-none">
        <div class="text-15px font-800 text-muted uppercase tracking-wider">Credit · pay later</div>
        <div class="font-display text-44px font-700 text-terracotta leading-tight">{{ fmtMoney(totalCents) }}</div>
      </div>

      <!-- add-new, pinned at the top -->
      <div class="px-24px pt-20px pb-14px flex-none">
        <div class="text-15px font-800 text-muted mb-8px">New creditor</div>
        <div class="flex gap-10px">
          <TextInput
            v-model="newName"
            class="flex-1"
            title="Creditor name"
            placeholder="Type a name…"
          />
          <button
            class="btn-pay h-44px px-22px text-17px flex-none disabled:opacity-40 disabled:cursor-default"
            :disabled="!canAdd"
            @click="addNew"
          >Add</button>
        </div>
      </div>

      <!-- existing creditors -->
      <div class="px-24px pb-8px flex-none text-15px font-800 text-muted">
        {{ names.length ? "Previous creditors" : "No creditors yet" }}
      </div>
      <div class="px-24px pb-8px flex-1 overflow-auto flex flex-col gap-10px min-h-60px">
        <button
          v-for="n in filtered"
          :key="n"
          class="flex items-center justify-between px-20px py-15px rounded-16px border-2 border-border bg-tile cursor-pointer text-left press"
          @click="pick(n)"
        >
          <span class="text-20px font-800 text-ink truncate">{{ n }}</span>
          <span class="text-15px font-800 text-muted flex-none ml-10px">credit ›</span>
        </button>
        <div v-if="names.length && !filtered.length" class="text-15px font-700 text-faint py-10px">
          No match — tap “Add” to create “{{ newName.trim() }}”.
        </div>
      </div>

      <div class="px-24px py-20px flex-none border-t-2 border-borderSoft">
        <button
          class="w-full h-54px rounded-16px border-2 border-border bg-white text-18px font-800 text-muted cursor-pointer"
          @click="$emit('close')"
        >Cancel</button>
      </div>
    </div>
  </div>
</template>
