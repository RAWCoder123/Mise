# Purchase-loop post-count variance measurement

Date: 2026-08-27  
Branch: `cursor/mise-purchase-loop-count-variance`  
Base: `origin/cursor/mise-product-inspection-9632` (PR #193 receive outcomes)

## Problem

Receive-phase purchase-loop outcomes left `countVariancePending: true`. The gap audit still needed a later count measurement linking predicted, ordered, received, and counted variance without inventing inventory facts.

## Change

1. Domain helpers select pending receive lines and build `mise.purchase_loop_outcome.v1` count-phase payloads with opaque lesson codes.
2. Demo `approveInventoryCountSession` writes an observe `measure_outcome` action plus append-only count variance outcome when receive evidence overlaps counted items.
3. Additive migration `20260827001000_purchase_loop_count_variance.sql` records the same contract after hosted count approval.
4. Gap audit Future learning row updated; count variance is no longer pending in the measurement contract.

## Non-goals

- Does not change recommendation quantities, purchase authority, or send envelopes.
- Does not mutate historical receive outcomes (append-only).
- Does not feed lessons back into ordering policy yet.
- Does not duplicate open soft-refresh / readiness / Square catalog PRs.

## Verification

- `npm run typecheck`
- `node --test tests/purchaseLoopOutcome.test.ts tests/purchaseLoopCountVarianceMigration.test.ts tests/purchaseLoopOutcomeMigration.test.ts`
- Broader `npm test` after commit
