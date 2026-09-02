# POS sale sold_at for count-anchored depletion (2026-09-02)

Branch: `cursor/mise-pos-sale-sold-at`
Base: `origin/main` @ `20b28e5`

## Problem

POS sales on main are day-resolution only. After a midday verified count,
`dayResolutionConsumptionIsAfterCount` treats **all** same-day mapped sales as
already absorbed — including afternoon sales after the count — so projected
on-hand stops moving until the next day.

Stale open #131 bundled obsolete `last_counted_at` with sold_at and conflicts
with MISE-001 count authority. This slice is sold_at-only.

## Shipped

- Additive `pos_sales.sold_at timestamptz`
- Square `normalizeOrderSales` emits `closed_at` as `sold_at`
- `service_apply_square_sync_result_mise_003a_base` persists/coalesces sold_at
- `fetch_planning_sales` preserves today's timed rows (historical complete
  provider identity still aggregates for demand baselines)
- Domain: `saleEffectiveAt` + `isSaleInDepletionWindow` in
  `inventoryCountAuthority`; wired through `buildInventoryPrediction` and
  `calculateOperationalSignals`
- Demo current-day sales carry `sold_at`; rolling date refresh keeps clock time
- Tests: domain midday timed depletion, Square normalizer, migration pin

## Explicit non-goals

- Reintroducing `last_counted_at`
- Cash-only / unitemized Square refunds
- Contested receive/orders stacks
- Inventing MOQ / lead_time / expiration

## Follow-ons

- Deploy additive migration before hosted use
- Close/supersede conflicting #131 rather than merging wholesale
- After #357 lands: still leave cash-only refunds as diagnostics-only
