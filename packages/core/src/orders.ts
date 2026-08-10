import type { PaymentMethod, Order } from "./types.js";
import { PAYMENT_METHODS } from "./types.js";
import type { OrderDraft, PosRepo } from "./repo.js";
import { priceLine } from "./pricing.js";

export class PosError extends Error {
  constructor(
    message: string,
    readonly code = "bad_request",
  ) {
    super(message);
    this.name = "PosError";
  }
}

export interface OrderLineInput {
  itemId?: number;
  key?: string;
  qtyMilli: number;
  /** head count ("ekor") for tail-tracking items; ignored otherwise */
  tailCount?: number;
}

export interface CreateOrderInput {
  method: PaymentMethod;
  ts?: number;
  /** Business day the sale counts toward; defaults to ts's local calendar day. */
  businessDate?: string;
  /** Company the sale belongs to; defaults to 1 when omitted. */
  companyId?: number;
  /** Required when method is "Credit": the creditor the sale is owed by. */
  creditorName?: string;
  lines: OrderLineInput[];
}

/**
 * Resolve + price an order against the catalogue. Pure given the items it's
 * handed — the source of truth for price is the DB, never the caller. Throws
 * PosError on any invalid line.
 */
export function buildOrder(
  input: CreateOrderInput,
  resolve: (line: OrderLineInput) => import("./types.js").PricedItem | null,
): OrderDraft {
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new PosError(`method must be one of ${PAYMENT_METHODS.join(", ")}`);
  }
  if (input.method === "Credit" && !input.creditorName?.trim()) {
    throw new PosError("a creditor name is required for credit sales");
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new PosError("an order needs at least one line");
  }

  const lines = input.lines.map((line) => {
    const item = resolve(line);
    if (!item || !item.active) {
      throw new PosError(
        `unknown or inactive item: ${JSON.stringify(line.itemId ?? line.key)}`,
        "unknown_item",
      );
    }
    if (!(line.qtyMilli > 0)) {
      throw new PosError(`qty must be > 0 for ${item.name}`);
    }
    const { unitCents, amountCents, tier } = priceLine(item, line.qtyMilli);
    return {
      itemId: item.id,
      name: item.name,
      image: item.image,
      unit: item.unit,
      tint: item.tint,
      priceCents: unitCents, // effective (post-tier) price, snapshotted
      qtyMilli: line.qtyMilli,
      amountCents,
      // Tail count is independent of qty; only meaningful for tracksTail items.
      // Requiring entry is a till-side rule (see cart.pay), so stay lenient here.
      tailCount: item.tracksTail ? Math.max(0, Math.round(line.tailCount ?? 0)) : 0,
      bulkPrice: tier !== null,
      ...(tier ? { bulkMinQtyMilli: tier.minQtyMilli } : {}),
    };
  });

  const totalCents = lines.reduce((a, l) => a + l.amountCents, 0);
  return {
    companyId: input.companyId ?? 1,
    ts: input.ts ?? Date.now(),
    method: input.method,
    totalCents,
    lines,
    ...(input.businessDate ? { businessDate: input.businessDate } : {}),
    ...(input.method === "Credit" ? { creditorName: input.creditorName!.trim() } : {}),
  };
}

/** Read catalogue → build+price → persist atomically. */
export async function createOrder(
  repo: PosRepo,
  input: CreateOrderInput,
): Promise<Order> {
  // Pre-fetch every referenced item so buildOrder can stay synchronous/pure.
  const cache = new Map<string, import("./types.js").PricedItem | null>();
  for (const line of input.lines ?? []) {
    if (line.itemId != null && !cache.has(`id:${line.itemId}`)) {
      cache.set(`id:${line.itemId}`, await repo.getItem(line.itemId));
    } else if (line.key != null && !cache.has(`key:${line.key}`)) {
      cache.set(`key:${line.key}`, await repo.getItemByKey(line.key));
    }
  }
  const draft = buildOrder(input, (line) =>
    line.itemId != null
      ? (cache.get(`id:${line.itemId}`) ?? null)
      : line.key != null
        ? (cache.get(`key:${line.key}`) ?? null)
        : null,
  );
  return repo.persistOrder(draft);
}
