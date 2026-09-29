# MISE-005CJ: pin recalculation_runs.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-recalculation-runs-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `recalculation_runs.status` allowlist (`succeeded` /
`failed`) with the exact-token contract plus ASCII shape under COLLATE `"C"`:

```sql
status in ('succeeded', 'failed')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint (`services/domain/recalculationRunTransport.ts`,
`services/application/recalculationCycles.ts`):

- `succeeded` — cycle completed without failure_reason / timeout
- `failed` — cycle failed or timed out; failure_reason required

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
`recalculation_runs` keys (#452) and `job_name` (#453), and
`inventory_count_sessions.status` (#495), but leave `recalculation_runs.status`
on bare IN only. Without a dedicated COLLATE C shape CHECK, dump/restore under
LC_CTYPE drift can accept recalculation outcome bytes the restored C-locale
path would refuse — or the reverse — breaking schedule continuity across
restore.

## Scope

- CHECK-only on `public.recalculation_runs.status`
- Does **not** rewrite `public.record_recalculation_run`
- Does **not** touch `recalculation_runs_failure_check`
- Does **not** touch cycle / monitoring_owner allowlists
- Does **not** touch key (#452) or job_name (#453) pins
- Does **not** touch `inventory_count_sessions.status` (#495)
- Alone on main OK; timestamp after #495 (`20260929220000`)

## Verification

- `npm run typecheck`
- focused `tests/recalculationRunsStatusLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 10 from 10 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929220000_mise_005cj_recalculation_runs_status_locale_pin.sql`
- `supabase/tests/database/recalculation_runs_status_locale_pin.test.sql`
- `tests/recalculationRunsStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-recalculation-runs-status-locale-pin.md`
