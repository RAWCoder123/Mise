# Draft order persistent per-line undo (2026-08-30)

Tip: `cursor/mise-draft-order-line-undo`; base `main` @ `20b28e5`.

## Problem
Orders hub undo toast expires after 7s. After that, managers could not reverse one approved recommendation inside a multi-line draft without waiting for whole-draft cancel (#282) or starting over.

## Fix
- Domain helper `linkedApprovedRecommendationsForOrder` selects approved lines bound to a draft.
- `fetchSupplierOrderOperationalDetail` returns `linkedRecommendations`.
- Draft order detail shows Approved lines with persistent Undo (existing `undo_purchase_recommendation_action`).
- Empty-draft undo navigates back; EN/ES/zh-Hans copy added.
- `undoPurchaseRecommendationAction` now returns the full workflow result (hub updated).

## Verification
- `npm run typecheck`
- focused domain test
- `npm test` (as available)
