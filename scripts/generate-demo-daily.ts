import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Order, OrderLine, PaymentMethod, Unit } from "@yf/core";
import { buildDailyExcelB64 } from "../apps/pos/src/report/daily";

const businessDate = "2026-08-10";

function line(input: {
  id: number;
  itemId: number;
  name: string;
  unit: Unit;
  priceCents: number;
  qtyMilli: number;
  amountCents: number;
  tailCount?: number;
}): OrderLine {
  return {
    ...input,
    image: "",
    tint: "#fff",
    tailCount: input.tailCount ?? 0,
    bulkPrice: false,
  };
}

function order(input: {
  id: number;
  hour: number;
  minute: number;
  method: PaymentMethod;
  items: OrderLine[];
  creditorName?: string;
  voided?: boolean;
}): Order {
  return {
    id: input.id,
    companyId: 1,
    ts: new Date(2026, 7, 10, input.hour, input.minute).getTime(),
    businessDate,
    method: input.method,
    totalCents: input.items.reduce((sum, item) => sum + item.amountCents, 0),
    items: input.items,
    ...(input.creditorName ? { creditorName: input.creditorName } : {}),
    voidedAt: input.voided ? new Date(2026, 7, 10, input.hour, input.minute + 5).getTime() : null,
  };
}

const orders: Order[] = [
  order({
    id: 1001,
    hour: 8,
    minute: 15,
    method: "Cash",
    items: [
      line({ id: 1, itemId: 1, name: "Ikan Tilapia", unit: "kg", priceCents: 2500, qtyMilli: 12750, amountCents: 31875, tailCount: 18 }),
      line({ id: 2, itemId: 2, name: "Fresh Milk 500 ml", unit: "bottle", priceCents: 680, qtyMilli: 3000, amountCents: 2040 }),
    ],
  }),
  order({
    id: 1002,
    hour: 9,
    minute: 40,
    method: "Credit",
    creditorName: "Pak Abu",
    items: [
      line({ id: 3, itemId: 1, name: "Ikan Tilapia", unit: "kg", priceCents: 2500, qtyMilli: 4200, amountCents: 10500, tailCount: 6 }),
      line({ id: 4, itemId: 3, name: "Ayam", unit: "each", priceCents: 1200, qtyMilli: 5000, amountCents: 6000, tailCount: 5 }),
    ],
  }),
  order({
    id: 1003,
    hour: 11,
    minute: 5,
    method: "Bank",
    items: [
      line({ id: 5, itemId: 4, name: "Sayur Campur", unit: "kg", priceCents: 600, qtyMilli: 2750, amountCents: 1650 }),
      line({ id: 6, itemId: 5, name: "UHT 200 ml", unit: "box", priceCents: 3600, qtyMilli: 2000, amountCents: 7200 }),
    ],
  }),
  order({
    id: 1004,
    hour: 13,
    minute: 20,
    method: "QR",
    items: [
      line({ id: 7, itemId: 6, name: "Durian", unit: "kg", priceCents: 1800, qtyMilli: 3500, amountCents: 6300 }),
      line({ id: 8, itemId: 7, name: "Avocado", unit: "pack", priceCents: 900, qtyMilli: 2000, amountCents: 1800 }),
    ],
  }),
  order({
    id: 1005,
    hour: 14,
    minute: 10,
    method: "Cash",
    voided: true,
    items: [
      line({ id: 9, itemId: 1, name: "Ikan Tilapia", unit: "kg", priceCents: 2500, qtyMilli: 1000, amountCents: 2500, tailCount: 2 }),
    ],
  }),
];

const output = resolve(process.argv[2] ?? "demo-output/hq-daily-demo.xlsx");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.from(buildDailyExcelB64(orders), "base64"));
process.stdout.write(`${output}\n`);
