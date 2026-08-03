# Team mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-0473`

## Gap

`/settings/team` already had soft-refresh and RetryNotice for load failures, plus StatusNotice for mutation outcomes, but notices used a single title-only MessageKey with no body, mutation tone selection lived inline in the screen, and invite/add/role actions were gated only by a local `busyKey` check rather than shared presentation helpers.

## Change

- Extended `services/presentation/teamHubPresentation.ts` with mutation busy/editable helpers and reason-specific notice copy (title + message + tone).
- `/settings/team` now maps invalid email, add/invite/copy/revoke, role update, enable/disable, and remove outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans).
- Mutation failures continue to call `captureMiseError` and never surface raw exception text.
- Invite, add, revoke, enable/disable, and remove actions stay gated while any team mutation is busy or the hub is not ready.
- Extended `tests/teamHubPresentation.test.ts` for helpers and StatusNotice wiring.

## Verification

- `npm run typecheck` — passed
- `npm test` — 490 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
