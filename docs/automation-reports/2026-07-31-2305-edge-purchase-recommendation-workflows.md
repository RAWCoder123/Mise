# Edge-route purchase recommendation and order draft workflows (2026-07-31)

## Problem

Purchase recommendation approve/dismiss/undo, supplier order draft edits, and the Gmail mark-sent observation RPC remained callable as authenticated Data API RPCs. That bypassed `operational-workflows` Edge reservation, rate limiting, and Edge audit logging even though peer mutations (place, receive, transfer, waste, counts) already required the Edge path.

## Change

- Migration `20260731230000_edge_purchase_recommendation_workflows.sql`:
  - Adds service-owned `approve` / `dismiss` / `undo` / `update_supplier_order_draft` / `mark_supplier_order_sent` RPCs (manager+, service_role only).
  - Revokes authenticated execute on the legacy public RPCs.
  - Domain audit for these actions is recorded by Edge after the service RPC returns.
- Edge `operational-workflows` adds the five manager-only actions with audit actions `recommendation_approved`, `recommendation_dismissed`, `recommendation_undo`, `supplier_order_draft_updated`, and `supplier_order_sent_observed`.
- Hosted repository methods now invoke those Edge actions instead of direct RPCs. Local demo paths unchanged.
- Staging tenant/race checks and pgTAP authority/isolation tests updated for the service-owned path.

## Verification

- Static security contracts cover Edge action + service RPC + revoke patterns.
- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static` in this cycle.
- Docker/hosted `verify:private-beta-security` still blocked in this environment (no Docker / no staging credentials).
