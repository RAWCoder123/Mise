# Home since-away title chrome (2026-08-30)

## Summary

Surface the existing unused `home.sinceAway.title` catalog string above the
localized Home activity-window sentence from #274 so operators get an explicit
"since you were away" heading in EN / ES / zh-Hans.

## Changes

- `app/(tabs)/home.tsx` — wrap the window sentence in a `sinceAwayBlock` that
  leads with `t("home.sinceAway.title")` and a combined accessibility label.
- `tests/homeSinceAwayTitle.test.ts` — catalog coverage + static wiring order.

## Stack

Depends on #274 (`cursor/mise-activity-window-sentence-i18n`). Does not rewrite
durable English `ActivityWindowSummary.sentence` or activity row copy.

## Verification

- `npm run typecheck`
- `npm test -- tests/homeSinceAwayTitle.test.ts tests/activityWindowCopy.test.ts`
- broader `npm test` / `npm run security:static` as available
