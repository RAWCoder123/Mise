# Activity title/summary i18n (2026-08-30)

## Scope

Localize Home and Activity hub event **titles** and **summaries** from
`activityType` + structured metadata without rewriting durable English audit
rows. Complements #239 (category/status/trigger enums only).

## Changes

- `services/presentation/activityEventCopy.ts` — `presentActivityTitle` /
  `presentActivitySummary` with metadata synthesis and opaque fallbacks
- `i18n/catalog.ts` — EN / ES / zh-Hans title + summary templates
- `app/(tabs)/home.tsx`, `app/more/activity.tsx` — render localized copy
- `tests/activityEventCopy.test.ts`

## Non-goals

- Category/status/trigger labels (#239)
- Rewriting stored English title/summary columns
- Translating item/supplier/provider names or free-form finding titles
- Activity window sentence / story titles

## Verification

- `npm run typecheck`
- `npm test` (activityEventCopy + suite)
