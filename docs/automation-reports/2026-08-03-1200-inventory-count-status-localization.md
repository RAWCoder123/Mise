# Inventory count status localization (2026-08-03)

## Branch
`cursor/mise-product-inspection-5984` (FF from `cursor/mise-product-inspection-bec4`)

## Gap
`/inventory/count` rendered raw English `caught.message` for start/save/submit/approve/cancel failures and used plain Text for success notices. Client validation threw localized Errors but backend failures leaked English exception text into the operator UI.

## Change
- Extended `services/presentation/inventoryCountPresentation.ts` with:
  - `resolveInventoryCountFailureReason`
  - `presentInventoryCountFailureCopy` / `presentInventoryCountSuccessCopy`
  - `buildInventoryCountLinePayload` (structured client validation)
- `/inventory/count` now uses localized `StatusNotice` for mutation outcomes, keeps load failures on `RetryNotice`, and reports failures through `captureMiseError`.
- Added EN/ES/zh-Hans notice keys for already-open, no-items, capacity, status, permission, quantity/note bounds, and related count failures.
- Tests cover failure mapping, payload validation, screen wiring, and security assertions.

## Verification
- `npm run typecheck`
- `npm test` (453 passed)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof were not available in this environment.

## Product state
Controlled pilot-ready code path for inventory count operator messaging. Remaining release blockers are ops/credentials (Docker/hosted proof, Auth redirects, Apple/EAS, live POS/Gmail).
