import { computed, ref, type ComputedRef, type Ref } from "vue";
import { toRM } from "@yf/core";

// Cents-first money entry, the way a till works: the display always reads a
// full 0.00 amount and every digit pushes in from the rightmost cent column.
// 3,0,0 -> 3.00 and 5,5,0 -> 5.50, so there is no decimal-point key.

/** RM 9,999,999.99 — more than the till will ever take in one sale. */
const MAX_DIGITS = 9;

export interface CentsEntry {
  /** Raw digit string (no leading zeroes); "" means nothing typed yet. */
  digits: Ref<string>;
  cents: ComputedRef<number>;
  /** Always 2-decimal, e.g. "0.00" / "5.50". */
  text: ComputedRef<string>;
  /** Append one or more digits ("7", "00"), dropping overflow. */
  push: (d: string) => void;
  backspace: () => void;
  clear: () => void;
  /** Restart the entry, optionally seeded with an existing amount. */
  reset: (cents?: number) => void;
}

export function useCentsEntry(initialCents = 0): CentsEntry {
  const digits = ref("");
  const cents = computed(() => (digits.value === "" ? 0 : Number(digits.value)));
  const text = computed(() => toRM(cents.value).toFixed(2));

  function push(d: string): void {
    if (!/^[0-9]+$/.test(d)) return;
    const next = (digits.value + d).replace(/^0+(?=[0-9])/, "");
    digits.value = next.slice(0, MAX_DIGITS);
  }
  function backspace(): void {
    digits.value = digits.value.slice(0, -1);
  }
  function clear(): void {
    digits.value = "";
  }
  function reset(c = 0): void {
    const whole = Math.max(0, Math.round(c));
    digits.value = whole ? String(whole).slice(0, MAX_DIGITS) : "";
  }

  reset(initialCents);
  return { digits, cents, text, push, backspace, clear, reset };
}
