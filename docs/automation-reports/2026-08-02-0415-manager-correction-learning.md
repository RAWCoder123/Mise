# Manager correction learning (2026-08-02)

Branch: `cursor/mise-product-inspection-4ed8`  
Base tip: includes Add-to-Order learning parity (`f13b95b`)

## Problem

Single-item inventory edits were already ledgered as `manager_correction`, but restaurant learning ignored them. Repeated downward manager corrections (system on-hand drifting high) did not pad future order quantities or surface a chronic pattern on Today/Insights.

## Implemented

1. Domain extensions in `services/domain/wasteVarianceLearning.ts`
   - Extract downward `manager_correction` samples
   - Bounded chronic bias (`source: "manager_correction"`) using the shared loss window/multiplier rules
2. Migration `20260802040930_manager_correction_learning_snapshot.sql`
   - Snapshot key `managerCorrectionHistory`
   - Partial index for manager-correction ledger reads
3. Edge `update_inventory` appends in-flight downward samples before signal refresh
4. Stacked learning (approval → receive → waste → count shrink → manager correction) in operational signals, demo rebuilds, and manual Add to Order
5. Insight `insight.rule.inventory.chronic_manager_correction` + Today `today.inventory.chronic_manager_correction` (manager, `/inventory`)
6. Unit/pgTAP/static security contracts

## Verification

- `npm run typecheck`
- `npm test` (323)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). Remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
