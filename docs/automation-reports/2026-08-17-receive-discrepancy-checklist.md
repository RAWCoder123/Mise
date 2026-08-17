# Receive discrepancy checklist (2026-08-17)

Branch: `cursor/mise-product-inspection-1033`  
Commit: `20c35f2`

## Problem

Sent supplier orders could only be marked received as-ordered. The hosted RPC and demo ledger already accepted damaged/missing/reason line fields, so short-ships never reached inventory learning or delivery evidence from the operator UI.

## Change

1. Domain (`services/domain/supplierDelivery.ts`)
   - `applyDeliveryLineAdjustments` / `normalizeDeliveryLineDiscrepancy`
   - Auto-derives missing quantity for short-ships
   - `buildSupplierDeliveryReceivePreview` for the checklist
2. Application (`services/application/deliveries.ts`)
   - `previewSupplierOrderDelivery`
   - `receiveSupplierOrderDelivery(..., { lineAdjustments })`
3. Order detail UI with per-line received/damaged/reason editing, reset-as-ordered, EN/ES/zh-Hans copy
4. Demo repository persists `discrepancy_reason` on delivery items

## Verification

- `npm run typecheck`
- `npm test` — 508 pass / 0 fail (7 pre-existing timeout cancels)
- `npm run security:static`
- `npm run security:backend`

## Classification

Controlled pilot code tip improvement. Not App Store submission-ready.

## Intentionally not done

- Did not overlap open PRs #130–#133 (readiness/provider identity, count freshness, planning sync stale, Gmail unknown resolution)
- No Docker/pgTAP hosted proof in this environment
