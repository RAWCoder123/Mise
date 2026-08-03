# Recipes mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-95a9`

## Gap

`/settings/recipes` already had soft-refresh and RetryNotice for load failures, but mutation validation, save, link, and unlink outcomes still rendered as plain `Text` error/notice lines. Failures were swallowed without telemetry, and there were no reusable presentation helpers for busy/editable/notice copy.

## Change

- Extended `services/presentation/recipesHubPresentation.ts` with mutation busy/editable helpers and reason-specific notice copy.
- `/settings/recipes` now maps read-only, quantity, menu item, inventory item, wrong-restaurant, save/add/unlink failures, and saved/linked/unlinked successes to localized StatusNotice titles + bodies (EN/ES/zh-Hans).
- Mutation failures call `captureMiseError` and never surface raw exception text.
- Builder and mapped-row edits stay gated while any recipe mutation is busy.
- Extended `tests/recipesHubPresentation.test.ts` for helpers and StatusNotice wiring.

## Verification

- `npm run typecheck`
- `npm test` (483 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
