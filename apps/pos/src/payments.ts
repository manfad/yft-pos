import type { PaymentMethod } from "@yf/core";

// Per-method presentation (label + icon + colours) — matches the demo design.
export const PAYMENT_UI: Record<PaymentMethod, { label: string; icon: string; color: string; tint: string }> = {
  Cash: { label: "CASH", icon: "💵", color: "#6e8a4e", tint: "#e3ecd6" },
  Bank: { label: "BANK", icon: "🏦", color: "#3f7c8c", tint: "#d8e8ec" },
  QR: { label: "QR", icon: "📱", color: "#c4753f", tint: "#f6e0cf" },
  Credit: { label: "CREDIT", icon: "📝", color: "#9a6b34", tint: "#efe3cf" },
};
