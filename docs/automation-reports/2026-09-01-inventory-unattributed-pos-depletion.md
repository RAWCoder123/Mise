# Inventory unattributed same-day POS depletion UI

Tip: `cursor/mise-inventory-unattributed-pos-depletion`
Base: `origin/main` @ `20b28e5`

## Problem

Domain already computes `unattributedTodayDepletion` and `isTemporallyAuthoritative`
when a verified count happens during the same operating day as mapped POS sales.
Those sales stay in the count baseline (not double-subtracted). Inventory detail
still showed POS depleted as `0` and the “no mapped POS depletion” copy, which
made midday counts look like “no POS use.”

## Fix

- Localize absorbed-POS depletion and include today’s mapped POS in basis when
  demand was absorbed rather than post-count depleted
- Inventory detail: caution StatusNotice for temporal authority, POS-in-count
  rail/hero label, and depletion evidence row for absorbed demand
- EN / ES / zh-Hans catalog keys
- Presentation + static UI wiring tests

## Paths

- `i18n/inventoryPresentation.ts`
- `i18n/catalog.ts`
- `app/inventory/[id].tsx`
- `tests/inventoryUnattributedPosPresentation.test.ts`
- `docs/automation-reports/2026-09-01-inventory-unattributed-pos-depletion.md`

## Distinct from

- Contaminated chronology UI (#310)
- Stale / unverified count freshness (#313)

## Verification

- `npm run typecheck` passed
- Focused `tests/inventoryUnattributedPosPresentation.test.ts` 6/6
- `npm test` — 638 pass / 0 fail / 7 cancelled
