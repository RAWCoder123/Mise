# Waste / count-variance learning (2026-08-02)

Branch: `cursor/mise-product-inspection-bf3d`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-3a96` (`09bb913`)

## Problem

Waste and negative inventory-count variance were already written to the ledger, but operational recommendations ignored that history. Chronic spoilage or unexplained shrink could leave restaurants understocked while Mise kept recommending par-only quantities.

## Implemented

1. Domain `services/domain/wasteVarianceLearning.ts`
   - Window 180d, newest 8 samples, ≥3 required
   - Winsorize loss ratio `[0, 0.35]`; chronic if median ≥ 0.08
   - Multiplier `clamp(1 + median, 1, 1.2)` then absolute bounds vs calculated/par
2. Migration `20260802030000_waste_count_variance_learning_snapshot.sql`
   - Snapshot keys `wasteHistory` + `countVarianceHistory`
   - Partial indexes for waste / manual_count ledger reads
3. Edge `record_waste` / `approve_count_session` append in-flight samples before signal refresh
4. Demo + live `PlanningData`, application signal paths, and `miseDomain` rebuild parity
5. Insights `insight.rule.waste.chronic_waste` + `insight.rule.inventory.chronic_count_shrink`
6. Today tasks `today.waste.chronic_waste` (Inventory) and `today.inventory.chronic_count_shrink` (count session)
7. EN/ES/ZH presentation copy + operationsPresentation coverage
8. pgTAP `waste_count_variance_learning.test.sql` + security static contract

## Verification

- `npm run typecheck`
- `npm test` (313)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). This closes the next ranked restaurant-learning gap after receive discrepancy learning; remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
