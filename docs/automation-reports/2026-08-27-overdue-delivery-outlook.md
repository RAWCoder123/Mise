# Overdue supplier delivery outlook (2026-08-27)

Branch: `cursor/mise-overdue-delivery-outlook`  
Base: `origin/main` @ `20b28e5`

## Gap

`OperatingOutlook.deliveryStatus` included `"overdue"` and daily phase briefs already
escalated overdue delivery findings to urgent rank, but `buildOutlook` never set the
status. Sent (and late draft) supplier orders always rendered as `"expected"`, so Home
and Pre-Service never treated past-due receipts as attention-worthy.

## Closed

- Deterministic `classifySupplierDeliveryOutlook` compares evidenced `delivery_date` to
  the restaurant operating date for open (`draft` / `sent`) orders.
- Overdue status elevates restaurant pulse to `attention_needed`, sets `topRisk`, and
  ranks monitoring rows as overdue receipts.
- Pre-service phase finding title no longer claims `0 deliveries logged` when overdue.
- Home status banner surfaces overdue delivery in EN / ES / ZH and routes to Orders.

## Paths

- `services/domain/operatingBrief.ts`
- `services/domain/dailyPhaseBrief.ts`
- `app/(tabs)/home.tsx`
- `i18n/catalog.ts`
- `tests/operatingBrief.test.ts`
- `tests/dailyPhaseBrief.test.ts`

## Verification

- `npm run typecheck` passed
- `node --import tsx --test tests/operatingBrief.test.ts tests/dailyPhaseBrief.test.ts`
  — 14/14 passed

## Non-overlap

Independent of open stacks #130–#204 (receive-line integrity, 004B learning, Today
receive-task projection, soft-refresh, readiness gates). Complementary to #204: this
surfaces overdue receipt on Home/brief even when Today still marks `sent` as send-complete.
