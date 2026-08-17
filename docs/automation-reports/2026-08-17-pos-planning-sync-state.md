# POS planning sync state after sales commit

Date: 2026-08-17  
Branch: `cursor/mise-product-inspection-153f`  
Baseline: `origin/main` @ `312c6f1`

## Problem

`sync-pos-sales` could persist Square sales and still return `completed` when the follow-up `refresh_signals` call failed. Planning then silently lagged sales, and Today treated a connected POS as complete.

## Change

- Additive migration `20260817021000_pos_planning_sync_state.sql` adds `planning_sync_status`, `planning_synced_at`, and `planning_sync_error_code` on `pos_integrations`.
- Service-role RPC `service_record_pos_planning_sync_state` records fresh/stale outcomes with audit rows.
- `sync-pos-sales` marks planning stale after sales commit, sets `signal_refresh_failed` when refresh fails, and clears to fresh on success.
- Successful operational signal commits clear restaurant planning stale state.
- Today and POS settings surface planning-stale attention for connected integrations.

## Verification

- `npm run typecheck`
- `npm test` (targeted + full suite)
- `npm run security:static` / `npm run security:backend` when runnable

## Not claimed

- Hosted/Docker pgTAP proof
- Live Square OAuth/sync evidence
- Readiness enforcement at recommendation approval (tracked separately / PR #130)
- Count freshness anchoring (PR #131)
