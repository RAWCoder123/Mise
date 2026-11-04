# Task verification structured evidence (2026-08-28)

## Gap
Shared restaurant tasks advertised `count` / `receipt` verification, but completion only required a free-text note. Staff could mark a count task complete without a submitted inventory count session.

## Fix
- Domain: `assertStructuredVerificationEvidence`, `buildCountSessionCompletionEvidence`, `buildSupplierReceiptCompletionEvidence`
- Hosted: additive migration redefines `complete_restaurant_task` to require live same-tenant `inventory_count_sessions` (submitted/approved) or completed `supplier_orders`
- Demo parity + application pre-check before RPC
- Task detail UI: link eligible count sessions / completed receipts instead of free-text for those methods
- i18n EN/ES/zh-Hans
- Tests: domain, demo repository, migration pin, pgTAP phrases

## Verification
- `npm run typecheck`
- focused + full `npm test` (see commit notes)
- `npm run security:backend` / `npm run security:static` when available

## Classification
Controlled pilot improvement. Deploy additive migration before hosted tenants get the fail-closed RPC behavior.
