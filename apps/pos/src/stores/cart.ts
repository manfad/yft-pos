import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  createOrder,
  effectiveUnitPrice,
  appliedTier,
  lineAmount,
  type Order,
  type PaymentMethod,
  type PricedItem,
} from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";

export interface CartLine {
  uid: number;
  item: PricedItem;
  qtyMilli: number;
}

export const useCart = defineStore("cart", () => {
  const lines = ref<CartLine[]>([]);
  const activeUid = ref<number | null>(null);
  let nextUid = 1;

  const active = computed(() => lines.value.find((l) => l.uid === activeUid.value) ?? null);

  /** Effective (post-tier) unit price in cents. */
  const unitCentsOf = (l: CartLine): number => effectiveUnitPrice(l.item, l.qtyMilli);

  /** Effective (post-tier) line total in cents. */
  const amountOf = (l: CartLine): number => lineAmount(unitCentsOf(l), l.qtyMilli);

  /** True when a quantity discount is currently active on this line. */
  const discounted = (l: CartLine): boolean => appliedTier(l.item, l.qtyMilli) !== null;

  const totalCents = computed(() => lines.value.reduce((a, l) => a + amountOf(l), 0));

  function add(item: PricedItem): void {
    const ex = lines.value.find((l) => l.item.id === item.id);
    if (ex) {
      ex.qtyMilli += 1000;
      activeUid.value = ex.uid;
    } else {
      const uid = nextUid++;
      lines.value.push({ uid, item, qtyMilli: 1000 });
      activeUid.value = uid;
    }
  }

  /** Adjust the active line by `deltaUnits` (e.g. 0.5, 1, 10, -1). */
  function adjust(deltaUnits: number): void {
    const l = active.value;
    if (!l) return;
    l.qtyMilli = Math.max(0, l.qtyMilli + Math.round(deltaUnits * 1000));
  }

  /** Step a specific line (used by the per-line +/- buttons), making it active. */
  function step(uid: number, deltaUnits: number): void {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return;
    activeUid.value = uid;
    l.qtyMilli = Math.max(0, l.qtyMilli + Math.round(deltaUnits * 1000));
  }

  /** Set a line's quantity to an absolute value in units (from the numpad). */
  function setQty(uid: number, units: number): void {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return;
    activeUid.value = uid;
    l.qtyMilli = Math.max(0, Math.round(units * 1000));
  }

  function remove(uid: number): void {
    lines.value = lines.value.filter((l) => l.uid !== uid);
    if (activeUid.value === uid) {
      activeUid.value = lines.value.at(-1)?.uid ?? null;
    }
  }

  function select(uid: number): void {
    activeUid.value = uid;
  }

  function clear(): void {
    lines.value = [];
    activeUid.value = null;
  }

  // A cart only makes sense within one company — switching empties it.
  watch(() => currentCompany.value.id, clear);

  async function pay(method: PaymentMethod): Promise<Order | null> {
    const payable = lines.value.filter((l) => l.qtyMilli > 0);
    if (payable.length === 0 || totalCents.value <= 0) return null;
    const repo = await getRepo();
    const order = await createOrder(repo, {
      method,
      companyId: currentCompany.value.id,
      lines: payable.map((l) => ({ itemId: l.item.id, qtyMilli: l.qtyMilli })),
    });
    clear();
    return order;
  }

  return {
    lines, activeUid, active, totalCents,
    amountOf, unitCentsOf, discounted, add, adjust, step, setQty, remove, select, clear, pay,
  };
});
