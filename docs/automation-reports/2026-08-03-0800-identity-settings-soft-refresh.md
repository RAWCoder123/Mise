# Profile and restaurant identity soft-refresh polish

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-7018`
Base tip: `origin/cursor/mise-product-inspection-e857`

## Gap

`/settings/profile` and `/settings/restaurant` could flash empty or “no restaurant” before session hydration finished, ignored refresh failures, and had no RetryNotice path. Soft reloads also risked wiping in-progress edits.

## Fix

- Added `services/presentation/identitySettingsPresentation.ts` for loading/ready/error/missing presentation.
- Profile reloads display name through `fetchMyDisplayName`, keeps last-known values on soft failure, preserves dirty edits, and surfaces RetryNotice.
- Restaurant identity reloads through `fetchRestaurant`, seeds from the active session restaurant, keeps last-known drafts on soft failure, and only shows the genuine missing-restaurant state after the session is ready.
- Both screens use Screen loading for first paint without seed data, keep values non-interactive while loading/failed, and add EN / ES / zh-Hans copy for loading, unavailable, and retry states.

## Verification

- `npm run typecheck` — passed
- `npm test` — 437/437 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed (includes `/settings/profile` and `/settings/restaurant`)
- Docker `supabase:test` still unavailable in this environment
