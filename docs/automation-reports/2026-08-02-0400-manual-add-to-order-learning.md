# Manual Add to Order learning parity (2026-08-02)

Branch: `cursor/mise-product-inspection-4ed8`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-bf3d` (`0b10086`)

## Problem

Inventory detail **Add to Order** created pending purchase recommendations from raw `prediction.suggestedOrderQuantity`. Generated recommendation rebuilds already applied approval-median, receive-fill, waste, and count-shrink learning. Operators using the explicit inventory path got weaker, unlearned quantities than Mise’s automatic queue.

## Implemented

1. Domain helpers in `services/domain/miseDomain.ts`
   - `applyStackedOrderLearning` — shared approval → receive → waste → count-shrink stack
   - `planManualPendingRecommendation` — single-item planner for operator-initiated drafts (no Critical/Low filter)
2. `addInventoryItemToOrder` loads planning histories and uses `planManualPendingRecommendation`
3. `rebuildPurchaseRecommendations` and `buildRecommendationInserts` call the shared stack
4. Unit coverage for approval-median and chronic-waste parity vs generated inserts
5. Security static contract that manual add-to-order cannot regress to raw suggested quantities

## Verification

- `npm run typecheck`
- `npm test` (316)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). This closes a critical purchasing-path learning parity gap. Remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
