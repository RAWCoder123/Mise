# MISE-005AS: pin recalculation_runs.job_name CHECK to COLLATE C

**Date:** 2026-09-27  
**Branch:** `cursor/mise-recalculation-job-name-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Summary

Replace the length-only CHECK on `public.recalculation_runs.job_name` with a named ASCII shape gate under `COLLATE "C"`:

```sql
job_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Why

`job_name` is the durable human-readable cycle identity on every append-only recalculation attempt. Writers mint exactly three ASCII tokens from `services/domain/recalculationSchedule.ts`:

- `recalculation.daily_open`
- `recalculation.mid_shift`
- `recalculation.close`

Length-only bounds accept spaces, control bytes, and non-ASCII that can diverge under `LC_CTYPE` drift on dump/restore — breaking schedule correlation after MISE-005A proved locale drift on this cluster. MISE-005AR (#452) pinned `cycle_key` / `idempotency_key` but left `job_name` length-only.

## Scope

- CHECK-only on `recalculation_runs_job_name_check`
- Does **not** rewrite `public.record_recalculation_run`
- Does **not** touch cycle_key / idempotency_key (#452), purchase_decision source_event_key (#451), or provider failure_code (#450)

## Compose

Alone on main OK. Timestamp after MISE-005AR (#452).

## Verification

- `npm run typecheck` — passed
- focused `tests/recalculationJobNameLocalePin.test.ts` — 3/3 passed
- `npm test` — 679 passed / 0 failed / 7 cancelled (withTimeout baseline)
- pgTAP fixture committed; Docker/hosted pgTAP not executed in this environment

## Files

- `supabase/migrations/20260927160000_mise_005as_recalculation_job_name_locale_pin.sql`
- `supabase/tests/database/recalculation_job_name_locale_pin.test.sql`
- `tests/recalculationJobNameLocalePin.test.ts`
- `docs/automation-reports/2026-09-27-recalculation-job-name-locale-pin.md`
