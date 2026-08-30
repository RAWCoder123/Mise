# Activity window sentence i18n (2026-08-30)

## Scope

Localize the Home “since you were away” activity-window sentence from
structured `ActivityWindowSummary` counts (forecasts, supplier orders,
staffing risks, routine checks) without rewriting the durable English
`sentence` field on the domain summary.

## Changes

- `services/presentation/activityWindowCopy.ts` — `presentActivityWindowSentence`
- `i18n/catalog.ts` — EN / ES / zh-Hans window templates + plural parts
- `app/(tabs)/home.tsx` — Activity section shows the localized lead sentence
- `tests/activityWindowCopy.test.ts`

## Non-goals

- Rewriting durable `ActivityWindowSummary.sentence`
- Activity title/summary presentation (#271)
- Activity evidence-line summaries (#273)
- Activity enum labels (#239)
- Inventing activity when counts are zero

## Verification

- `npm run typecheck`
- `npm test` (activityWindowCopy + suite)
- `npm run security:static`
