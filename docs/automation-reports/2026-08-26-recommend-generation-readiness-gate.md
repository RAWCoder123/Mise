# Recommendation generation pilot-readiness gate

Date: 2026-08-26  
Branch: `cursor/mise-recommend-generation-readiness-gate`  
Baseline: `origin/main` @ `20b28e5`

## Problem

Pilot readiness already computed whether a restaurant may trust purchase
recommendations (`canRecommend`), but recommendation **writes** still ran
without that check:

- `generatePurchaseRecommendations`
- `regenerateOperationalSignals` (scheduled / setup refresh)
- `addInventoryItemToOrder` (manual inventory → order)

That left an UNSAFE path from the first-restaurant gap audit: pending
recommendations could be created from incomplete POS history, missing physical
counts, or weak recipe coverage. UI hide/show is not authorization.

Approval-path gating remains in complementary PR #178. This slice closes the
**generation** side.

## Changes

1. Domain helpers: `PilotReadinessBlockedError`,
   `PilotReadinessUnavailableError`, `assertPilotCanRecommend`.
2. Application: `requirePilotCanRecommend` fail-closed wrapper.
3. `generatePurchaseRecommendations` and `addInventoryItemToOrder` require
   `canRecommend` before any write.
4. `regenerateOperationalSignals` still refreshes insights, but publishes an
   **empty** recommendation set when readiness is blocked or unavailable
   (insights stay useful; untrustworthy order suggestions do not).
5. Demo schema v14 seeds verified canonical units + physical-count ledger rows
   so local demo `canRecommend` stays true for the operating loop.
6. Inventory detail surfaces readiness-blocked / unavailable add-to-order copy
   in EN / ES / zh-Hans.

## Intentionally not in this PR

- Server-side SQL revalidation inside `approve_purchase_recommendation`
  (Codex / migration).
- Home/Orders approve UI readiness banners (#177) and application approve gate
  (#178).
- Soft-refresh hubReady work (#150–#176).

## Verification

- `npm run typecheck`
- Focused: `tests/pilotRecommendGenerationGate.test.ts` plus demo readiness /
  schema expectations
- Broader `npm test` after typecheck
