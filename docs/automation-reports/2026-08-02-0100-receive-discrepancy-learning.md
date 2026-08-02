# Receive discrepancy learning (2026-08-02)

Branch: `cursor/mise-product-inspection-48f0`  
Base tip: fast-forwarded from `origin/cursor/mise-product-inspection-e444` (`6bc9511`)

## Problem

Supplier-order receiving already stored ordered-versus-received discrepancies on the inventory ledger, but Mise never learned from them. Chronic short-ships could leave restaurants understocked while recommendations kept assuming full deliveries.

## Implemented

1. Domain module `services/domain/receiveDiscrepancyLearning.ts`
   - Median fill-rate over last 180 days / newest 8 samples / ≥3 required
   - Winsorize fills to `[0.25, 1.0]`; chronic when median ≤ 0.92 and ≥3 short samples
   - Order padding multiplier capped at `1.25`, then re-checked against existing absolute bounds
2. Migration `20260802010000_receive_discrepancy_learning_snapshot.sql`
   - Adds `receivingHistory` to `private.fetch_operational_planning_snapshot`
   - Partial index on receiving movements
3. Edge `receive_supplier_order` appends in-flight receive samples before signal refresh
4. Demo/application/repository parity for planning data + signal rebuilds
5. Chronic short-ship ordering insight + manager Today task (`/orders`)
6. Presentation/i18n (en / es / zh-Hans)
7. Unit tests + pgTAP `receive_discrepancy_learning.test.sql` + static security assertions

## Verification

- `npm run typecheck` pass
- `npm test` 302 pass
- `npm run security:backend` pass
- `npm run security:static` pass
- `npm run design:static` pass
- Docker `supabase:test` / hosted re-proof still unavailable in this environment

## Classification

Still **controlled pilot-ready** (not App Store submission-ready). This closes a restaurant-learning gap on supplier fill rates; remaining blockers are ops/credentials (Docker/hosted RLS re-proof, Auth redirects, privacy URLs, Apple/EAS, live POS/Gmail).
