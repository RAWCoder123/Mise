# POS planning sync state (fresh port of #132)

Date: 2026-08-26
Branch: `cursor/mise-pos-planning-sync-state`
Base: `origin/main` @ `20b28e5`

## Status

Superseded on 2026-11-11 by the main rebase tip:

- Branch: `cursor/mise-pos-planning-sync-state-main`
- Report: `docs/automation-reports/2026-11-11-pos-planning-sync-state.md`
- Migration filename advanced to `20261111000000_pos_planning_sync_state.sql`

Keep this file only as historical evidence for draft #185.

## Gap

Square sales could commit while `refresh_signals` failed silently. Planning stayed behind live sales with no durable operator-visible marker.

## Closed (original #185)

- Additive migration (originally `20260826140000_pos_planning_sync_state.sql`) adds planning sync columns on `pos_integrations`.
- Service-role-only `service_record_pos_planning_sync_state` recorder with actor/tenant role checks.
- `sync-pos-sales` marks planning stale after sales commit, records `signal_refresh_failed` on refresh failure, and clears to fresh on success.
- Generation-bound recorder writes; fail closed when persist fails.
- Today / POS settings operator attention for stale planning.

## Supersedes

- Conflicting draft #132 (`cursor/mise-product-inspection-153f`) for this gap.
