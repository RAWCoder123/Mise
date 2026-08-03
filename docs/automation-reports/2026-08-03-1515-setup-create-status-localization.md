# Setup create StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-aeb2`

## Gap

`/setup` already used `StatusNotice`, but step/create failures shared one generic title, create failures were swallowed without telemetry, and there was no reusable presentation helper for busy/editable/notice copy.

## Change

- Added `services/presentation/setupCreatePresentation.ts` for busy/editable state and notice copy.
- `/setup` now maps profile continue, profile navigate, validation, and create failures to reason-specific EN/ES/zh-Hans notice titles.
- Create failures call `captureMiseError` and never surface raw exception text.
- Validation still uses the existing localized draft messages as StatusNotice body copy.
- Added `tests/setupCreatePresentation.test.ts` and updated the prior setup StatusNotice wiring assertion.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
