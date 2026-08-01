# Automation report — 2026-08-01

## Completed

- Fixed sole-owner App Store account deletion: `request_my_account_deletion` now archives restaurants the caller solely owns, disables those restaurants’ active memberships (including staff), disables the caller’s remaining memberships, and records rollback metadata.
- Updated last-owner guard and membership role helpers to honor `restaurants.archived_at` / open deletion requests.
- Edge `request-account-deletion` calls `service_rollback_failed_account_deletion` when Auth hard-delete fails so access is restored instead of leaving a stuck disabled state.
- Added domain helpers + unit tests, pgTAP coverage, security static/backend assertions, and clearer delete-confirm copy (EN/ES/zh-Hans).

## Verification run this pass

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- Docker / hosted gates — not available in this environment

## Current product state

- Local demo: ready
- Controlled pilot: still blocked on Docker + hosted re-proof of the full migration chain (including this archive/rollback path)
- App Store submission: not ready (privacy/support URLs, Apple account, device QA remain external)

## Next highest-priority work

1. Surface CSV unmapped POS items as an actionable Today/Settings repair path (no credentials required).
2. Re-run Docker pgTAP + hosted security gates when available.
3. Edge-route remaining authenticated setup/profile mutation RPCs.
