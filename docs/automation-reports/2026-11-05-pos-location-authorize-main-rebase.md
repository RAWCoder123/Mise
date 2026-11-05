# POS location authorize/pause (main rebase)

Date: 2026-11-05  
Branch: `cursor/mise-pos-location-authorize-main-rebase`  
Baseline: `origin/main` @ `78da7376` (MISE-005A)

## Summary

Fresh re-implementation of draft #236 onto current `main`. Owners/admins can
authorize or pause Square `pos_locations` so multi-location merchants do not
sync every credential location by default. Sync and planning already filter
`location.status = 'active'`.

## Changes

- Additive migration `20261105130000_pos_location_authorization.sql`
  - Guarded `set_pos_location_status` (owner/admin; `active`/`paused` only)
  - OAuth reconnect preserves `paused` instead of force-reactivating
  - Authenticated Data API remains SELECT-only on `pos_locations`
- Settings → POS location list with Pause/Authorize controls (EN/ES/zh-Hans)
- Domain/validation/repository/application wiring + demo fail-closed stubs
- pgTAP `pos_location_authorization.test.sql` and TypeScript pins
- Pilot role matrix + gap audit updates

## Supersedes

Do not merge stale #236 (`cursor/mise-pos-location-authorize`). Prefer this tip.

## Verification

Recorded in the tip PR after local gates run.
