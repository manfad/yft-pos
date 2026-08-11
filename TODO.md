# TODO / delivery log

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

## 3. Credit system (pay-later / creditors) — ✅ DONE (2026-08-10)

Shipped: Credit payment method, required creditor picker with add-new and
previous names, persisted credit rows, outstanding-credit report panel, receipt
history, and single/all-credit clearing actions.

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

## 4. Excel export — ✅ DONE (2026-08-10)

Shipped: **Export Excel** on `/report` and a stable workbook with four sheets:

- **HQ Daily** — one row per invoice with creditor, amount/credit, fish quantity,
  fish Ekor, chicken Ekor, remarks, and footer totals.
- **Invoice Items** — one row per sold item with item/unit/qty/Ekor/unit price,
  line amount, credit amount, and remarks, so non-fish products remain visible.
- **Sales Export** — compact receipt export with fish and chicken split.
- **Totals** — per-item and payment-method reconciliation.

Voided sales are excluded from invoice exports but shown in reconciliation.
The workbook includes an empty-sales footer and stable column widths/formats.

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
- implemented with the existing SheetJS/`xlsx` dependency.

---

## 5. Daily admin Excel template + automatic email — ✅ DONE (2026-08-10)

Shipped: Close Day finalises the business date, builds the same versioned HQ
workbook, queues it in the offline outbox, attempts immediate delivery, prints
the roll report, and navigates to `/report`. The dialog now distinguishes
**sent** from **queued for automatic retry** and can recreate/retry a missing
report. A stable `close-day-YYYY-MM-DD.xlsx` artifact name makes repeat Close
Day calls idempotent without confusing an earlier manual report email.

After the basic app is finished, add a reusable `.xlsx` template for the daily report
that is emailed to the admin at Close Day. Use one row per invoice/order with these
base columns, expanded after HQ staff requested separate fish/chicken detail:

```
Name | Date | Inv No | Pay Type | Amount | Credit | Fish Qty |
Fish Qty (Ekor) | Chicken Qty (Ekor) | Remarks
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
- `Fish Qty` and `Fish Qty (Ekor)` include fish lines only.
- `Chicken Qty (Ekor)` is separate so it cannot be mistaken for fish.
- Non-fish quantities are preserved in the **Invoice Items** sheet.
- `Remarks` = blank by default, available for admin/cashier notes later.
- Add a footer row that totals `Amount`, `Credit`, and `Qty (Ekor)`.
- Generate one workbook per company and business date, attach it to the existing daily
  report email/outbox flow, and keep the template formatting stable across exports.

Implementation notes:
- Keep the workbook template versioned in code and populate it with SheetJS/`xlsx`.
- Add regression tests for normal payments, Credit name/amount population, Ekor totals,
  footer formulas/totals, and an empty-sales day.

---

## 7. First-day QoL batch — ✅ DONE (2026-08-11)

Owner feedback after the first live day:

- **Item drag-to-reorder**: `items.sort_order` column (migrated via `ensureColumn`,
  backfilled `= id`), `listItems` orders by it, `setItemOrder` repo method. `/item`
  rows reorder by press-and-hold (300 ms) + drag (vuedraggable); the till grid
  follows the same order. New items append at the end.
- **Item soft delete**: Delete button in the `/item` edit dialog (confirmation
  step) sets `active = 0` via the existing `setItemActive`. Deleted items vanish
  from `/item` and the till; no restore UI. Past orders/reports unaffected.
- **Cash change calculator**: the Pay dialog's Cash row gained a "Change" button →
  calculator view (Received − Total = Change, live; red "Short" when under).
  PAY CASH settles as a normal Cash sale; the tendered amount is never stored.
- **Cents-first money entry** (`useCentsEntry` in `apps/pos/src/centsEntry.ts`):
  money numpads always show 0.00 and digits push in from the cents column
  (3,0,0 → 3.00; 5,5,0 → 5.50). Applied to the calculator and to
  `NumpadDialog`'s new `money` mode (used by `NumberInput` when `decimals === 2`,
  i.e. the RM price fields). Quantity/ekor entry unchanged.
- **Workbook v3**: the single "Fish Sales" sheet is replaced by one sheet per
  active `tracksTail` item (named after the item, sanitized/deduped to Excel's
  31-char limit), matched by `line.itemId` — the fragile chicken-name regex is
  gone. Zero-sales items still get their sheet so the shape is stable. Behavior
  change vs v2: an order with a 0 ekor count shows as a 0-qty row instead of
  being hidden.
- **Bug fixes**: the three dashboard charts (hourly/weekly/monthly) no longer
  count voided sales; the red pill in transactions now reads CANCELLED (was
  VOID), matching the receipt dialog.
- **Invoice numbers** (`MM-<seq>`, e.g. `08-1000`): assigned at sale time from
  the order's *business-date* month, starting at 1000 per month (`orders.inv_no`,
  additive migration, deliberately NO backfill — sales made before the update
  keep displaying their order id, since those receipts were already printed).
  Voids keep their number; gaps are never reused. Shown everywhere a receipt
  number appears — transactions, receipt dialog, printed receipt, credit
  ledger, and every workbook "Inv No" column. Internal joins/keys still use
  `orders.id`.
- **Polish round**: kg weight entry uses the 0.00 push-entry numpad (counts
  don't); cents-first entry on all RM numpads; item rows tap-to-edit and
  hold-100ms-to-drag with a ⠿ hint column; Delete (red, full-width) below
  Save in the item dialog; keypad ⌫ keys red, Clear keys yellow; text-keyboard
  display uses the display font.

---

## 6. HQ workbook visual review — ⬜ REVIEW LATER

- Generate a representative demo workbook containing Cash, Credit, fish,
  chicken, non-fish products, a voided invoice, and an empty-sales day.
- Open and recalculate it with an available Office-compatible CLI (for example,
  LibreOffice headless), then render the sheets to PDF/images.
- Share the `.xlsx` and rendered sheets for owner/HQ staff review before changing
  template version 1.
