# POS planning sync state (fresh port of #132)

Date: 2026-08-26
Branch: `cursor/mise-pos-planning-sync-state`
Base: `origin/main` @ `20b28e5`

## Gap

Square sales could commit while `refresh_signals` failed silently. Planning stayed behind live sales with no durable operator-visible marker.

## Closed

- Additive migration `20260826140000_pos_planning_sync_state.sql` adds `planning_sync_status` / `planning_synced_at` / `planning_sync_error_code` on `pos_integrations`.
- Service-role-only `service_record_pos_planning_sync_state` recorder with actor/tenant role checks.
- `sync-pos-sales` marks planning stale after sales commit, records `signal_refresh_failed` on refresh failure, and clears to fresh on success.
- Successful operational signal commits (`refresh_signals`, inventory/recipe/setup/count-approve) clear restaurant planning stale state.
- Today keeps connected POS incomplete when planning attention is required; POS settings surfaces stale planning meta and sync warning (EN/ES/zh-Hans).
- Demo and hosted repository contracts expose `planningSyncStatus` on sync results.

## Pins

- `tests/posPlanningSync.test.ts`
- Domain helpers in `services/domain/posPlanningSync.ts`

## Do not redo

- Silent catch around refresh after sales commit.
- Treating connected POS as complete when `planning_sync_error_code` is set.
- Granting the recorder RPC to authenticated/anon.

## Supersedes

- Conflicting draft #132 (`cursor/mise-product-inspection-153f`) for this gap on current main.
