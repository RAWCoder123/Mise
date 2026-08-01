# Edge-route create pending purchase recommendation (2026-08-01)

## Problem

Managers could still create pending purchase recommendations through the authenticated Data API RPC `create_pending_purchase_recommendation`, bypassing `operational-workflows` Edge reservation, rate limiting, and Edge audit logging. Peer recommendation mutations (approve/dismiss/undo) were already service-owned.

## Change

- Migration `20260801001000_edge_create_pending_purchase_recommendation.sql`:
  - Adds service-owned `service_create_pending_purchase_recommendation` (manager+, `service_role` only).
  - Revokes authenticated execute on the legacy public create RPC.
- Edge `operational-workflows` adds manager-only action `create_pending_purchase_recommendation` with audit action `recommendation_created`.
- Hosted repository `createPurchaseRecommendation` now invokes that Edge action. Local demo path unchanged.
- pgTAP order authority tests cover privilege revoke, staff denial, cross-tenant denial, and manager success.
- Static security contracts updated for Edge action + service RPC + revoke patterns.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
