<script setup lang="ts">
import { nextTick, onUnmounted, useTemplateRef, watch } from "vue";

const dialogStack: symbol[] = [];

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  width?: string;
  layer?: number;
  closeOnBackdrop?: boolean;
}>(), { width: "760px", layer: 80, closeOnBackdrop: true });

const emit = defineEmits<{ close: [] }>();
const dialogId = Symbol("dialog");
const panel = useTemplateRef<HTMLElement>("panel");
let previousFocus: HTMLElement | null = null;

function close(): void { emit("close"); }

function onKeydown(event: KeyboardEvent): void {
  if (dialogStack.at(-1) !== dialogId) return;
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (event.key !== "Tab" || !panel.value) return;
  const focusable = [...panel.value.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']")];
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

watch(() => props.open, async (open) => {
  if (open) {
    dialogStack.push(dialogId);
    previousFocus = document.activeElement as HTMLElement | null;
    window.addEventListener("keydown", onKeydown);
    await nextTick();
    panel.value?.querySelector<HTMLElement>("button, input, select, textarea, [tabindex='0']")?.focus();
  } else {
    const index = dialogStack.lastIndexOf(dialogId);
    if (index >= 0) dialogStack.splice(index, 1);
    window.removeEventListener("keydown", onKeydown);
    previousFocus?.focus();
  }
});
onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  const index = dialogStack.lastIndexOf(dialogId);
  if (index >= 0) dialogStack.splice(index, 1);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 flex items-center justify-center p-24px bg-[rgba(44,38,32,.52)]"
      :style="{ zIndex: layer }"
      @click.self="closeOnBackdrop && close()"
    >
      <section
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="max-w-full max-h-[94vh] bg-surface rounded-28px shadow-[0_24px_70px_rgba(44,38,32,.35)] flex flex-col overflow-hidden"
        :style="{ width }"
      >
        <header class="flex-none flex items-center justify-between gap-20px px-26px py-20px border-b-2 border-borderSoft">
          <h2 class="m-0 font-display text-28px font-700 text-ink">{{ title }}</h2>
          <button class="yf-btn w-48px px-0 text-26px" aria-label="Close dialog" @click="close">×</button>
        </header>
        <div class="flex-1 min-h-0 overflow-auto">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex-none px-26px py-20px border-t-2 border-borderSoft bg-panel">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
