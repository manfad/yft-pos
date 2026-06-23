import { ref } from "vue";
import { MANAGER_PASSCODE } from "./config";

// Sales unlock is per-session: clears when the tab/app closes.
const KEY = "yf_sales_unlocked";

export const salesUnlocked = ref(sessionStorage.getItem(KEY) === "1");

export function tryUnlock(code: string): boolean {
  if (code === MANAGER_PASSCODE) {
    salesUnlocked.value = true;
    sessionStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}

export function lockSales(): void {
  salesUnlocked.value = false;
  sessionStorage.removeItem(KEY);
}
