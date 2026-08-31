# Contaminated count evidence UI (2026-08-31)

Tip: `cursor/mise-contaminated-count-evidence` @ `5b1325b` on `origin/main` @ `20b28e5`.

## Problem
Domain marks `countEvidence: contaminated_projection` when on-hand was overwritten by an invalid future-dated count. Application refuses Add to order. Inventory UI still showed ordinary Watch stock and an enabled Add to order button that failed with a generic error.

## Change
- `i18n/inventoryPresentation.ts`: distinct contaminated coverage/action/basis/confidence/why/recommendation; `contaminatedProjection` flag
- `app/inventory/[id].tsx`: warning StatusNotice; hide Add to order; force Count ops; fail-closed add guard
- `app/(tabs)/inventory.tsx`: recount badge/hint prioritized over canonical-unit needs-verification
- `i18n/catalog.ts`: EN/ES/zh-Hans keys
- `tests/inventoryPresentation.test.ts`: presentation + static UI wiring

## Verification
- typecheck pass
- inventoryPresentation 4/4
- npm test 636 pass / 0 fail / 7 cancelled
- no migration

## Classification
Controlled pilot-ready improvement. Not App Store submission-ready.
