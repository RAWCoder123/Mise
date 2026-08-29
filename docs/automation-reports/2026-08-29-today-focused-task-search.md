# 2026-08-29 — Today focused-bucket ranked task find

## Completed

- Added `services/domain/operatingPlanTaskSearch.ts` ranked find for Today focused operating-plan bucket items (title, detail, why, effect, related refs, bounded metadata).
- Wired search into `app/(tabs)/today.tsx`: appears when the focused bucket has ≥5 tasks or the query is non-empty; scopes to the focused bucket; suppresses non-focus teasers while searching; empty EN/ES/zh-Hans copy when no matches.
- Added unit coverage in `tests/operatingPlanTaskSearch.test.ts`.
- Catalog keys: `today.search.*` in EN / ES / zh-Hans.

## Workflows

- Operators can find a specific Now / Up next / Later / Done plan item without scrolling a long focused bucket.
- Empty query preserves existing focus + GROUP_CAPS teaser behavior.
- Restaurant switch clears the query.

## Verification

- `npm run typecheck`
- `npm test` (includes `operatingPlanTaskSearch`)
- `npm run design:static` when available

## Not claimed

- Does not invent plan items or change bucket membership / authority.
- Does not land open i18n / soft-cap stacks (#241–#262).
- Ask Mise `miseStatus` presentation still deferred pending #256/#259.
