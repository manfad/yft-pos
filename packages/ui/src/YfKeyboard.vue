<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import YfDialog from "./YfDialog.vue";

const props = withDefaults(defineProps<{ open: boolean; title: string; initial?: string; layer?: number }>(), { initial: "", layer: 120 });
const emit = defineEmits<{ confirm: [value: string]; close: [] }>();
const entry = shallowRef("");
const caps = shallowRef(false);
const symbols = shallowRef(false);
const letterRows = [["1","2","3","4","5","6","7","8","9","0"],["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]];
const symbolRows = [["!","@","#","$","%","&","*","+","="],["(",")","[","]","-","_","/",":"],[";",",",".","'","?","<",">"]];
const rows = computed(() => symbols.value ? symbolRows : letterRows);
watch(() => props.open, (open) => { if (open) { entry.value = props.initial; caps.value = false; symbols.value = false; } });
function tap(key: string): void { entry.value += caps.value && !symbols.value ? key.toUpperCase() : key; }
</script>

<template>
  <YfDialog :open="open" :title="title" width="920px" :layer="layer" @close="$emit('close')">
    <div class="p-20px">
      <output class="block min-h-70px px-18px py-15px mb-16px bg-warm rounded-16px font-display text-30px font-700 break-all">{{ entry }}</output>
      <div class="flex flex-col gap-10px">
        <div v-for="(row, index) in rows" :key="index" class="flex justify-center gap-8px">
          <button v-for="key in row" :key="key" class="yf-btn w-68px h-58px px-0 text-23px" @click="tap(key)">{{ caps && !symbols ? key.toUpperCase() : key }}</button>
        </div>
        <div class="flex justify-center gap-8px">
          <button class="yf-btn w-110px" @click="symbols = !symbols">{{ symbols ? "ABC" : "?#$" }}</button>
          <button v-if="!symbols" class="yf-btn w-110px" :class="caps ? 'bg-ink text-white border-ink' : ''" @click="caps = !caps">⇧ Caps</button>
          <button class="yf-btn flex-1 max-w-390px" @click="entry += ' '">Space</button>
          <button class="yf-btn w-110px text-danger border-danger" @click="entry = entry.slice(0, -1)">⌫</button>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="grid grid-cols-3 gap-12px">
        <button class="yf-btn" @click="entry = ''">Clear</button>
        <button class="yf-btn" @click="$emit('close')">Cancel</button>
        <button class="yf-btn-primary" @click="$emit('confirm', entry.trim())">OK</button>
      </div>
    </template>
  </YfDialog>
</template>
