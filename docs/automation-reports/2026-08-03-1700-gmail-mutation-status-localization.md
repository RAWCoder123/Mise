# Gmail mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-5443`

## Gap

`/settings/gmail` already had soft-refresh and RetryNotice for load failures, plus StatusNotice for mutation outcomes, but connect/disconnect/callback notices were assembled inline, error mapping lived in a screen-local `gmailErrorNotice` helper, mutation failures were swallowed without telemetry, and busy/editable gating was not shared through presentation helpers.

## Change

- Extended `services/presentation/gmailHubPresentation.ts` with mutation busy/editable helpers, reason-specific notice copy, and Gmail integration error reason mapping.
- `/settings/gmail` now maps owner-required, OAuth started, callback connected/failed, demo connected, and disconnect outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans).
- Connect/disconnect/load failures call `captureMiseError` and never surface raw exception text.
- Connect/disconnect actions stay gated while any Gmail mutation is busy.
- Extended `tests/gmailHubPresentation.test.ts` for helpers and StatusNotice wiring.

## Verification

- `npm run typecheck`
- `npm test` (487 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
