<script setup lang="ts">
import { computed, ref } from "vue";
import { PRODUCT_IMAGES, imageKey, listUserImages, setUserImages } from "../productImage";

// Touchscreen image picker: a grid of bundled photos plus any imported from a
// USB drive (Electron). One tap selects (and closes). Opened from the item editor.
defineProps<{ open: boolean; current: string }>();
const emit = defineEmits<{ select: [key: string]; close: [] }>();

const canImport = !!window.images;
const importing = ref(false);

// Bundled images are stored by key ("talapia"); user images by "user:<file>".
const tiles = computed(() => [
  ...PRODUCT_IMAGES.map((i) => ({ id: i.key, url: i.url })),
  ...listUserImages(),
]);

function isSelected(id: string, current: string): boolean {
  return id.startsWith("user:") ? current === id : imageKey(current) === id;
}

function pick(id: string): void {
  emit("select", id);
}

async function addMore(): Promise<void> {
  if (!window.images || importing.value) return;
  importing.value = true;
  try {
    setUserImages(await window.images.import());
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 bg-[rgba(44,38,32,.5)] flex items-center justify-center p-24px z-90"
    @click.self="$emit('close')"
  >
    <div
      class="w-720px max-w-full bg-surface rounded-26px shadow-[0_22px_64px_rgba(0,0,0,.32)] flex flex-col"
      style="max-height: 90vh"
    >
      <div class="px-24px pt-22px pb-16px border-b-2 border-borderSoft flex-none flex items-center justify-between gap-12px">
        <div class="text-18px font-800 text-ink">Select image</div>
        <div class="flex items-center gap-10px">
          <button
            v-if="canImport"
            class="btn-pay h-40px px-18px text-15px"
            :class="importing ? 'opacity-60' : ''"
            @click="addMore"
          >{{ importing ? "Adding…" : "+ Add image" }}</button>
          <button class="pill-btn h-40px px-18px text-15px" @click="$emit('close')">Cancel</button>
        </div>
      </div>

      <div class="p-20px overflow-auto flex-1 min-h-0">
        <div class="grid grid-cols-4 gap-12px">
          <!-- clear -->
          <button
            class="aspect-square rounded-16px border-2 bg-tile flex flex-col items-center justify-center gap-6px cursor-pointer press"
            :class="imageKey(current) === '' && !current.startsWith('user:') ? 'border-olive' : 'border-border'"
            @click="pick('')"
          >
            <span class="text-30px">🚫</span>
            <span class="text-12px font-800 text-muted">No image</span>
          </button>

          <button
            v-for="t in tiles"
            :key="t.id"
            class="relative aspect-square rounded-16px border-2 overflow-hidden bg-white cursor-pointer press"
            :class="isSelected(t.id, current) ? 'border-olive' : 'border-border'"
            @click="pick(t.id)"
          >
            <img :src="t.url" :alt="t.id" class="w-full h-full object-contain" />
            <span
              v-if="isSelected(t.id, current)"
              class="absolute top-4px right-4px w-22px h-22px rounded-full bg-olive text-white text-13px font-900 flex items-center justify-center"
            >✓</span>
          </button>
        </div>

        <p v-if="!canImport" class="mt-14px text-13px font-700 text-faint text-center">
          Importing images from a drive is available in the desktop app.
        </p>
      </div>
    </div>
  </div>
</template>
