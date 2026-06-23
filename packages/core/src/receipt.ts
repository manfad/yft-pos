import type { Order, PaymentMethod } from "./types.js";
import { fmtMoney, fmtQty, unitLabel } from "./money.js";

// A device-agnostic receipt model. buildReceipt() turns a persisted Order into
// ready-to-render text; concrete printers (HTML/PDF now, ESC/POS later) consume
// this shape, so swapping hardware never touches pricing or the domain.

export interface ReceiptLine {
  name: string;
  qtyText: string; // e.g. "1.5"
  unitPriceText: string; // e.g. "RM 25.00/kg" or "RM 23.00/kg (10kg)"
  amountText: string; // e.g. "RM 37.50"
}

export interface Receipt {
  storeName: string;
  orderId: number;
  dateText: string;
  method: PaymentMethod;
  itemCount: number;
  lines: ReceiptLine[];
  totalText: string;
  footer: string;
}

export interface BuildReceiptOptions {
  storeName: string;
  /** Optional note printed at the bottom (defaults to a thank-you). */
  footer?: string;
}

export function buildReceipt(order: Order, opts: BuildReceiptOptions): Receipt {
  const d = new Date(order.ts);
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateText = `${datePart} · ${timePart}`;
  return {
    storeName: opts.storeName,
    orderId: order.id,
    dateText,
    method: order.method,
    itemCount: order.items.length,
    totalText: fmtMoney(order.totalCents),
    footer: opts.footer ?? "Thank you!",
    lines: order.items.map((it) => ({
      name: it.name,
      qtyText: fmtQty(it.qtyMilli),
      unitPriceText:
        `${fmtMoney(it.priceCents)}/${unitLabel(it.unit)}` +
        (it.bulkPrice && it.bulkMinQtyMilli != null
          ? ` (${fmtQty(it.bulkMinQtyMilli)}${unitLabel(it.unit, it.bulkMinQtyMilli)})`
          : ""),
      amountText: fmtMoney(it.amountCents),
    })),
  };
}
