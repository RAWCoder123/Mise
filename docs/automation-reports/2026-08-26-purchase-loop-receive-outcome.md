# Purchase-loop receive outcome measurement

Date: 2026-08-26  
Branch: `cursor/mise-product-inspection-9632`  
Base: `origin/main` @ `20b28e5`

## Problem

Supplier delivery `action_outcomes` only recorded delivery status match. The pilot gap audit required a single measurement linking predicted recommendation quantity, ordered quantity, received quantity, and later count variance.

## Change

1. Domain helper `services/domain/purchaseLoopOutcome.ts` builds `mise.purchase_loop_outcome.v1` receive-phase payloads with opaque lesson codes and explicit `countVariancePending`.
2. Demo `recordSupplierOrderDelivery` writes that structured expected/actual/variance payload.
3. Additive migration `20260826230000_purchase_loop_receive_outcome.sql` replaces the compatibility base delivery writer so hosted outcomes use the same quantitative contract.
4. Gap audit Future learning row updated to PARTIAL with count-variance still pending.

## Non-goals

- Does not invent post-count variance.
- Does not change recommendation quantities, purchase authority, or send envelopes.
- Does not duplicate open soft-refresh / readiness / receive-discrepancy UI PRs.

## Verification

- `npx tsc --noEmit` / `npm run typecheck`
- `node --test tests/purchaseLoopOutcome.test.ts tests/purchaseLoopOutcomeMigration.test.ts`
- Broader `npm test` after commit
