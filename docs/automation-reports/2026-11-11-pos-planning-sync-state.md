# POS planning sync state (rebased onto main)

Date: 2026-11-11
Branch: `cursor/mise-pos-planning-sync-state-main`
Base: `origin/main` @ `78da7376`

## Gap

Square sales could commit while `refresh_signals` failed silently. Planning stayed behind live sales with no durable operator-visible marker.

## Closed

- Additive migration `20261111000000_pos_planning_sync_state.sql` adds `planning_sync_status` / `planning_synced_at` / `planning_sync_error_code` / `planning_sync_generation` on `pos_integrations`.
- Service-role-only `service_record_pos_planning_sync_state` recorder with actor/tenant role checks.
- `sync-pos-sales` marks planning stale after sales commit, records `signal_refresh_failed` on refresh failure, and clears to fresh on success.
- Recorder writes are generation-bound to the sales authority sync token so an older overlapping sync cannot overwrite a newer planning outcome.
- Recorder RPC errors are not ignored: sync responses never claim durable `fresh` unless persistence succeeded; persist failures surface `planning_state_persist_failed`.
- Hosted sync parser fails closed to `stale` when planning status is missing.
- Successful operational signal commits (`refresh_signals`, inventory/recipe/setup/count-approve) clear restaurant planning stale state without generation match.
- Today keeps connected POS incomplete when planning attention is required; POS settings surfaces stale planning meta and sync warning (EN/ES/zh-Hans).
- Demo and hosted repository contracts expose `planningSyncStatus` on sync results.

## Pins

- `tests/posPlanningSync.test.ts` — **43** assertion call sites counted from source
- Domain helpers in `services/domain/posPlanningSync.ts`

## Do not redo

- Silent catch around refresh after sales commit.
- Treating connected POS as complete when `planning_sync_error_code` is set.
- Granting the recorder RPC to authenticated/anon.
- Claiming planning fresh when the recorder errors or the generation was superseded.

## Supersedes

- Draft #185 (`cursor/mise-pos-planning-sync-state`) and conflicting #132 for this gap on current main.
- Migration filename advanced from `20260826140000` to `20261111000000` so deployed databases that already applied MISE-004C can still receive the additive change.
