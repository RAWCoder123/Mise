# Preference settings StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-aeb2` (fast-forwarded from `da24`)

## Gap

`/settings/language` and `/settings/notifications` rendered save success/failure with one-off colored status boxes instead of the shared `StatusNotice` pattern used by login, reset, signup, profile, and restaurant identity screens.

## Change

- Extended `preferenceSettingsPresentation` with `presentLanguageSettingsNoticeCopy` and `presentNotificationSettingsNoticeCopy`.
- Migrated both preference screens to localized `StatusNotice` outcomes with EN/ES/zh-Hans notice titles.
- Language success notices resolve copy in the newly selected locale.
- Save failures call `captureMiseError` and never surface raw exception text.
- Regression coverage updated in `preferenceSettingsPresentation.test.ts`.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
