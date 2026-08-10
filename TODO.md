# TODO — tomorrow morning (2026-06-25)

Three tasks, in order. File pointers are from a code scan done 2026-06-24.

---

## 1. Tail count per item (how many fish / chicken sold, not just kg) — ✅ DONE (2026-06-25)

Track a **count of animals/pieces** ("tail" / "ekor") alongside the existing kg weight, so the
report can show "38 fish, 25 chickens today".

Shipped: `tracks_tail` boolean on `items` (+ admin toggle "Sold by tail (ekor)"),
`tail_count` on `order_items` (both migrated via `ensureColumn`). Till shows a second
**Ekor** stepper (independent of qty) only for tail-tracking lines, numpad-editable, and
blocks PAY until a tail count is entered. Tilapia + Ayam seeded as `tracksTail`.

Decisions already made:
- **Per-item opt-in:** boolean flag `tracksTail` on the item. Only items with it set
  (fish, chicken) show / require a tail count.
- **Entry is manual + required:** when adding a `tracksTail` item, the cashier must
  enter the tail count before the line can be committed.

Changes:
- `packages/core/src/types.ts` — add `tracksTail: boolean` to `Item`; add
  `tailCount: number` to `CartLine` and `OrderLine`.
- `packages/core/src/schema.ts` + `packages/data/src/schema.ts` — `items.tracks_tail`,
  `order_items.tail_count` columns (+ migration).
- `apps/pos/src/stores/cart.ts` — `add()` / `setQty()` flow must capture tail count;
  block commit if `item.tracksTail` and count is empty.
- `apps/pos/src/views/TillView.vue` + `components/CartLine.vue` — tail input (numpad or
  small stepper) next to qty for `tracksTail` lines.
- `packages/core/src/orders.ts` — persist `tail_count`.

---

## 2. Slim down `/report` columns — ✅ DONE (2026-06-25)

Shipped: dropped the Cash/Online/QR split; columns are now **Item | Ekor | Qty | Amount**
(Ekor left of Qty, per-row only — not totalled). Day + Month sit side-by-side in one card
pinned to the left ~60% of the page. `tracks_tail` auto-backfills onto fish/chicken on
existing DBs (one-time, when the column is first added — admin toggles aren't clobbered).

Original note: Currently shows: item, qty, cash, bank, qr, total. Change to **just**:

```
item | qty | qty (tail) | amount
```

Drop the per-payment-type split (cash/bank/qr) — single `amount` column only.
`qty (tail)` = sum of the new `tail_count` from task 1.

Changes:
- `apps/pos/src/views/ReportView.vue` — drop `cash`/`bank`/`qr` from the `Row`
  interface and `aggregate()`; add `tailCount` accumulation; update the table template.
- `packages/core/src/stats.ts` — `ItemSale` / `aggregateItemSales()` already sum
  qty + amount; add `tailCount` here too if the report reads from it.

---

## 3. Credit system (pay-later / creditors)

In the checkout payment-type dialog (currently Cash | Bank | QR), add a **Credit**
option. Tapping Credit opens a second dialog:
- lists **previous creditor names** to pick from, **or** "add new" pinned at the top.
- on confirm, the order is recorded against that creditor as unpaid.

Data — **one table** is enough:

```
credits
  id          pk
  company_id  fk
  order_id    fk        -- the sale this credit covers
  name        text      -- creditor name (distinct names = the picker list)
  amount_cents int
  date        timestamp -- when credit taken (created)
  is_clear    timestamp nullable  -- null = outstanding; set = when paid off
```

- Creditor picker = `SELECT DISTINCT name FROM credits ...`.
- "Outstanding" = `is_clear IS NULL`.
- Clearing a credit = stamp `is_clear` with the payment timestamp.

Changes:
- `packages/core/src/types.ts` — add `"Credit"` to `PaymentMethod`; add `Credit` type.
- `packages/core/src/schema.ts` + `packages/data/src/schema.ts` — `credits` table (+ migration).
- `apps/pos/src/views/TillView.vue` (or wherever the payment-method dialog lives) —
  add Credit button → creditor dialog (list + add-new-on-top).
- `packages/core/src/orders.ts` — when method is Credit, also insert a `credits` row.
- (Later) a screen to view outstanding credits and mark them cleared.

---

## 4. Excel export

Export orders to an Excel/spreadsheet file. One row per receipt (order), columns:

```
date | time | receipt no | amount | qty | tail (fish) | tail (chicken) | pay_type
```

- `tail` is **split per animal** — separate `tail (fish)` and `tail (chicken)` columns,
  summed from the per-line `tail_count` (task 1) grouped by item.
- `receipt no` = order id; `pay_type` = order method (incl. new `Credit` from task 3).
- `date` / `time` split out from `order.ts` (epoch ms).

Changes:
- `apps/pos/src/views/ReportView.vue` (or a new export button) — add "Export Excel".
- depends on tasks 1 + 3 for the tail and Credit columns.
- pick a lib (e.g. SheetJS/`xlsx`) or emit CSV that opens in Excel — decide tomorrow.

---

## 5. Post-MVP: daily admin Excel template + automatic email

After the basic app is finished, add a reusable `.xlsx` template for the daily report
that is emailed to the admin at Close Day. Use one row per invoice/order with these
columns, in this order:

```
Name | Date | Inv No | Pay Type | Amount | Credit | Qty (Ekor) | Remarks
```

Close Day workflow:
1. The cashier presses **Close Day** in the top bar and confirms the close.
2. Finalise the current business day so no more sales are added to that report.
3. Generate the completed daily Excel workbook automatically.
4. Queue/send the workbook to HQ automatically through the existing email outbox.
5. Navigate the cashier to `/report` for the business day that was just closed.
6. Show whether the report was sent or safely queued for retry when the PC is offline.

The close must be idempotent: pressing Close Day again must not create or email a
duplicate workbook for the same company and business date.

Rules:
- `Name` = creditor name only when `Pay Type` is `Credit`; otherwise leave blank.
- `Date` = the order's business date.
- `Inv No` = order/receipt id.
- `Pay Type` = Cash, Bank, QR, or Credit.
- `Amount` = full invoice total.
- `Credit` = the invoice amount only when `Pay Type` is `Credit`; otherwise leave blank.
- `Qty (Ekor)` = total `tail_count` across the order's tail-tracking lines.
- `Remarks` = blank by default, available for admin/cashier notes later.
- Add a footer row that totals `Amount`, `Credit`, and `Qty (Ekor)`.
- Generate one workbook per company and business date, attach it to the existing daily
  report email/outbox flow, and keep the template formatting stable across exports.

Implementation notes:
- Keep the workbook template as a versioned app asset; populate it with SheetJS/`xlsx`.
- Add regression tests for normal payments, Credit name/amount population, Ekor totals,
  footer formulas/totals, and an empty-sales day.
