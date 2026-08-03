# Language and notifications soft-refresh polish

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-e857`
Base tip: `origin/cursor/mise-product-inspection-b3cf`

## Gap

`/settings/language` and `/settings/notifications` ignored preference load failures, could flash device/default selections before hosted prefs arrived, and had no RetryNotice path. Soft refresh also reset values to defaults while reloading the same operator scope.

## Fix

- Added `services/presentation/preferenceSettingsPresentation.ts` for loading/ready/error presentation.
- Locale and notification preference contexts now expose `loadError` + `reload()`, keep prior values on soft refresh, and only reset on scope change or hard retry.
- Both settings screens use Screen loading for first paint / hard retry, keep last-known values non-interactive on soft failure, and surface RetryNotice.
- EN / ES / zh-Hans copy for loading, unavailable, and retry states.

## Verification

- `npm run typecheck` — passed
- `npm test` — 433/433 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed (includes `/settings/language` and `/settings/notifications`)
- Docker `supabase:test` still unavailable in this environment
