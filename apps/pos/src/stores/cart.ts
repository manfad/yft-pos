import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import {
  createOrder,
  effectiveUnitPrice,
  appliedTier,
  lineAmount,
  stockLeftMilli,
  type Order,
  type PaymentMethod,
  type PricedItem,
} from "@yf/core";
import { getRepo } from "../db";
import { currentCompany } from "../place";
import { currentBusinessDate } from "../business";
import { useCatalog } from "./catalog";

export interface CartLine {
  uid: number;
  item: PricedItem;
  qtyMilli: number;
  /** head count ("ekor") — only used when item.tracksTail; independent of qty */
  tailCount: number;
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

  // Stock-tracked items can never be carted beyond what's left on the shelf.
  // (kg/untracked items pass through: stockLeftMilli is Infinity for them.)
  const capQty = (item: PricedItem, qtyMilli: number): number =>
    Math.min(qtyMilli, stockLeftMilli(item));

  function add(item: PricedItem): void {
    if (stockLeftMilli(item) <= 0) return; // sold out — the till shows the popup
    const ex = lines.value.find((l) => l.item.id === item.id);
    // For Ekor items, tapping the card counts heads (+1 ekor) rather than weight,
    // so a cashier can tally "6 fish" by tapping six times. Weight must be entered
    // separately; never assume 1 kg for the first fish.
    if (item.tracksTail) {
      if (ex) {
        ex.tailCount += 1;
        activeUid.value = ex.uid;
      } else {
        const uid = nextUid++;
        lines.value.push({ uid, item, qtyMilli: 0, tailCount: 1 });
        activeUid.value = uid;
      }
      return;
    }
    if (ex) {
      ex.qtyMilli = capQty(item, ex.qtyMilli + 1000);
      activeUid.value = ex.uid;
    } else {
      const uid = nextUid++;
      lines.value.push({ uid, item, qtyMilli: capQty(item, 1000), tailCount: 0 });
      activeUid.value = uid;
    }
  }

  /** Adjust the active line by `deltaUnits` (e.g. 0.5, 1, 10, -1). */
  /** Returns true when the increase was cut short by the stock cap. */
  function adjust(deltaUnits: number): boolean {
    const l = active.value;
    if (!l) return false;
    const want = Math.max(0, l.qtyMilli + Math.round(deltaUnits * 1000));
    l.qtyMilli = capQty(l.item, want);
    return l.qtyMilli < want;
  }

  /**
   * Step a specific line (used by the per-line +/- buttons), making it active.
   * Returns true when the increase was cut short by the stock cap.
   */
  function step(uid: number, deltaUnits: number): boolean {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return false;
    activeUid.value = uid;
    const want = Math.max(0, l.qtyMilli + Math.round(deltaUnits * 1000));
    l.qtyMilli = capQty(l.item, want);
    return l.qtyMilli < want;
  }

  /** Set a line's quantity to an absolute value in units (from the numpad). */
  function setQty(uid: number, units: number): void {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return;
    activeUid.value = uid;
    l.qtyMilli = capQty(l.item, Math.max(0, Math.round(units * 1000)));
  }

  // --- tail ("ekor") count — a whole number, fully independent of qtyMilli ---

  /** Adjust the active line's tail count by `delta` heads (e.g. ±1, ±10). */
  function adjustTail(delta: number): void {
    const l = active.value;
    if (!l) return;
    l.tailCount = Math.max(0, l.tailCount + Math.round(delta));
  }

  /** Step a specific line's tail count (per-line +/- in the cart), making it active. */
  function stepTail(uid: number, delta: number): void {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return;
    activeUid.value = uid;
    l.tailCount = Math.max(0, l.tailCount + Math.round(delta));
  }

  /** Set a line's tail count to an absolute value (from the numpad). */
  function setTail(uid: number, count: number): void {
    const l = lines.value.find((x) => x.uid === uid);
    if (!l) return;
    activeUid.value = uid;
    l.tailCount = Math.max(0, Math.round(count));
  }

  /** First fish/chicken line missing either its weighed quantity or head count. */
  const missingTail = computed(
    () => lines.value.find((l) => l.item.tracksTail && (l.qtyMilli <= 0 || l.tailCount <= 0)) ?? null,
  );

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

  // Keep in-cart lines in step with catalogue edits (e.g. a price tier added in
  // admin). `add()` captures the item object, so without this a line keeps its
  // stale price/tiers until the cart is cleared — re-point each line to the
  // freshly loaded item so pricing updates live instead of needing a reload.
  const catalog = useCatalog();
  watch(
    () => catalog.items,
    (fresh) => {
      const byId = new Map(fresh.map((i) => [i.id, i]));
      for (const l of lines.value) {
        const updated = byId.get(l.item.id);
        if (updated) l.item = updated;
      }
    },
  );

  async function pay(method: PaymentMethod, creditorName?: string): Promise<Order | null> {
    const payable = lines.value.filter((l) => l.qtyMilli > 0);
    if (payable.length === 0 || totalCents.value <= 0) return null;
    // Fish/chicken need both weight and head count before they can be sold.
    if (lines.value.some((l) => l.item.tracksTail && (l.qtyMilli <= 0 || l.tailCount <= 0))) return null;
    if (method === "Credit" && !creditorName?.trim()) return null;
    const repo = await getRepo();
    // Sales after Close Day count toward the next business day.
    const businessDate = await currentBusinessDate(currentCompany.value.id);
    const order = await createOrder(repo, {
      method,
      companyId: currentCompany.value.id,
      businessDate,
      ...(method === "Credit" ? { creditorName: creditorName!.trim() } : {}),
      lines: payable.map((l) => ({
        itemId: l.item.id,
        qtyMilli: l.qtyMilli,
        ...(l.item.tracksTail ? { tailCount: l.tailCount } : {}),
      })),
    });
    clear();
    return order;
  }

  return {
    lines, activeUid, active, totalCents, missingTail,
    amountOf, unitCentsOf, discounted, add, adjust, step, setQty,
    adjustTail, stepTail, setTail, remove, select, clear, pay,
  };
});
