# Activity feed ranked text find (2026-08-29)

## Change
Add title/summary/related ranked find on More → Activity history so operators can
locate events inside the loaded (≤160) timeline without inventing rows.

## Scope
- `services/domain/activityFeedSearch.ts` — pure ranked filter
- `tests/activityFeedSearch.test.ts`
- `app/more/activity.tsx` — search field when ≥5 events (or active query)
- EN / ES / zh-Hans catalog keys for search chrome and empty matches

## Distinct from
- #239 Activity hub enum i18n (category/status/trigger labels)
- Soft-refresh fail-closed stacks on the same screen (#150/#176/#180)

## Verification
- `npm run typecheck`
- `node --test --import tsx tests/activityFeedSearch.test.ts tests/localization.test.ts`
- `npm test`
