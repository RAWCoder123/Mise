# Inventory create status localization polish

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-bec4`
Base tip: `origin/cursor/mise-product-inspection-88a9`

## Gap

`/inventory/new` already created manager-owned SKUs, but save failures rendered raw English `error.message` text and used plain `Text` instead of `StatusNotice`. Session loading could briefly claim “no workspace,” and category accessibility labels used English preset values. Setup step/create failures also used plain error text.

## Fix

- Added `services/presentation/inventoryCreatePresentation.ts` with:
  - `resolveInventoryCreateAccessState`
  - `presentInventoryCreateFormEditable`
  - `resolveInventoryCreateFailureReason`
  - `presentInventoryCreateFailureCopy`
- `/inventory/new` now:
  - waits for session readiness before missing/readonly states
  - maps backend failures to EN / ES / zh-Hans notice keys
  - renders `StatusNotice` instead of raw exception text
  - disables fields while saving and clears notices on edit
  - uses localized category labels in accessibility copy
  - captures create failures with `captureMiseError`
- Setup surfaces localized `StatusNotice` for step/create failures.
- Tests: `tests/inventoryCreatePresentation.test.ts`; tenant-safety and security wiring updated.

## Verification

- `npm run typecheck` — passed
- `npm test` — 449/449 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed (includes `/inventory/new` and `/setup`)
- Docker `supabase:test` still unavailable in this environment

## Product state

- Classification remains **controlled pilot-ready** (not App Store submission-ready).
- Next implementable UX candidate after this: continue remaining form/status localization gaps, or Docker/hosted security re-proof when available.
- Still blocked: Docker/hosted private-beta security re-proof; founder Auth redirect / privacy URLs; Apple/EAS/device QA; live POS/Gmail credentials.
