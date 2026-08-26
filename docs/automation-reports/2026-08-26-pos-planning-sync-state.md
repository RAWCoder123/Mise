# POS planning sync state (fresh port of #132)

Date: 2026-08-26
Branch: `cursor/mise-pos-planning-sync-state`
Base: `origin/main` @ `20b28e5`

## Gap

Square sales could commit while `refresh_signals` failed silently. Planning stayed behind live sales with no durable operator-visible marker.

## Closed

- Additive migration `20260826140000_pos_planning_sync_state.sql` adds `planning_sync_status` / `planning_synced_at` / `planning_sync_error_code` / `planning_sync_generation` on `pos_integrations`.
- Service-role-only `service_record_pos_planning_sync_state` recorder with actor/tenant role checks.
- `sync-pos-sales` marks planning stale after sales commit, records `signal_refresh_failed` on refresh failure, and clears to fresh on success.
- Recorder writes are generation-bound to the sales authority sync token so an older overlapping sync cannot overwrite a newer planning outcome.
- Recorder RPC errors are not ignored: sync responses never claim durable `fresh` unless persistence succeeded; persist failures surface `planning_state_persist_failed`.
- Hosted sync parser fails closed to `stale` when planning status is missing.
- Successful operational signal commits (`refresh_signals`, inventory/recipe/setup/count-approve) clear restaurant planning stale state without generation match.
- Today keeps connected POS incomplete when planning attention is required; POS settings surfaces stale planning meta and sync warning (EN/ES/zh-Hans).
- Demo and hosted repository contracts expose `planningSyncStatus` on sync results.

## Greptile hardenings (same PR)

- P1 ignored recorder errors → checked; local status only becomes `fresh` after a successful persist.
- P1 last-writer-wins across concurrent syncs → `planning_sync_generation` + `p_match_generation`.

## Pins

- `tests/posPlanningSync.test.ts`
- Domain helpers in `services/domain/posPlanningSync.ts`

## Do not redo

- Silent catch around refresh after sales commit.
- Treating connected POS as complete when `planning_sync_error_code` is set.
- Granting the recorder RPC to authenticated/anon.
- Claiming planning fresh when the recorder errors or the generation was superseded.

## Supersedes

- Conflicting draft #132 (`cursor/mise-product-inspection-153f`) for this gap on current main.
