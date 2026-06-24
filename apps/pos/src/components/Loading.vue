<script setup lang="ts">
// Spinner while a promise runs, then a check icon on success. Matches the
// cream/olive design. Drive it with `state`.
defineProps<{ state: "loading" | "success"; message?: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-18px py-34px px-24px">
    <div v-if="state === 'loading'" class="yf-spinner" />
    <div v-else class="yf-check">
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 13l4 4L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="text-19px font-800 text-ink text-center">
      {{ message ?? (state === "loading" ? "Loading…" : "Done") }}
    </div>
  </div>
</template>

<style scoped>
.yf-spinner {
  width: 64px;
  height: 64px;
  border-radius: 9999px;
  border: 6px solid #f0e7d6; /* borderSoft */
  border-top-color: #6e8a4e; /* olive */
  animation: yf-spin 0.8s linear infinite;
}
@keyframes yf-spin {
  to {
    transform: rotate(360deg);
  }
}
.yf-check {
  width: 72px;
  height: 72px;
  border-radius: 9999px;
  background: #6e8a4e; /* olive */
  display: flex;
  align-items: center;
  justify-content: center;
  animation: yf-pop 0.34s cubic-bezier(0.2, 1.35, 0.5, 1);
}
@keyframes yf-pop {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
