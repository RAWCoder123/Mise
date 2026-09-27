# MISE-005AR: pin recalculation_runs cycle_key / idempotency_key CHECKs to COLLATE C

**Date:** 2026-09-27  
**Branch:** `cursor/mise-recalculation-run-key-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Summary

Replace the length-only CHECKs on `public.recalculation_runs.cycle_key` and `idempotency_key` with named ASCII shape gates under `COLLATE "C"`:

```sql
cycle_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
```

## Why

`idempotency_key` is the durable per-restaurant unique replay unit for append-only recalculation attempt evidence (`UNIQUE (restaurant_id, idempotency_key)`). `cycle_key` correlates retries of the same service-day cycle. Writers mint ASCII tokens (`recalc:` + restaurant UUID + ISO date + cycle + `:attempt-N`). Length-only bounds accept spaces, control bytes, and non-ASCII that can diverge under `LC_CTYPE` drift on dump/restore — breaking attempt continuity after MISE-005A proved locale drift on this cluster.

## Scope

- CHECK-only on `recalculation_runs_cycle_key_check` and `recalculation_runs_idempotency_key_check`
- Does **not** rewrite `public.record_recalculation_run`
- Does **not** touch purchase_decision source_event_key (#451) or provider failure_code (#450)

## Compose

Alone on main OK. Timestamp after MISE-005AQ (#451).

## Verification

- `npm run typecheck` — passed
- focused `tests/recalculationRunKeyLocalePin.test.ts` — 3/3 passed
- `npm test` — 679 passed / 0 failed / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed; Docker/hosted pgTAP not executed in this environment

## Files

- `supabase/migrations/20260927150000_mise_005ar_recalculation_run_key_locale_pin.sql`
- `supabase/tests/database/recalculation_run_key_locale_pin.test.sql`
- `tests/recalculationRunKeyLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-recalculation-run-key-locale-pin.md`
