# Supplier delivery verified_by INSERT evidence

Date: 2026-11-27  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-supplier-delivery-verified-by-evidence-main`

## Gap

`public.supplier_deliveries.verified_by` is nullable so account deletion can
anonymize only the verifier while preserving the delivery's operational
history. Hosted `public.record_supplier_delivery` stamps `auth.uid()`, but any
insert path that reaches the table can still mint an unattributable delivery
receipt with `verified_by = null` — a physical-receipt record Activity / audit
analysis cannot pin to an operator.

## Change

- Domain: `validateSupplierDeliveryVerifiedByEvidence` rejects
  `missing_verified_by` when the verifier id is null, undefined, or blank.
- Additive BEFORE INSERT trigger
  `private.enforce_supplier_delivery_verified_by_evidence` with the same rule.
- Intentionally **no** NOT NULL CHECK — a CHECK would block the auth
  ON DELETE SET NULL anonymization UPDATE escape.
- Does not rewrite `record_supplier_delivery`.
- pgTAP plan=8 from assertion call sites: null direct-insert reject,
  attributed direct insert accept, record_supplier_delivery RPC accept +
  verified_by stamp, account-deletion anonymization still clears only
  `verified_by`.

## Alone-OK

Orthogonal to supplier_delivery inventory receipt provenance (#1259), receipt
source allowlists (#1263), inventory actor attribution (#1280), purchase-line
recorded_by (#1292), and count-session actor tips (#1295/#1296). Does not
rewrite the delivery writer or restore table-level NOT NULL. Does not modify
shared `operational_backend_foundation.test.sql`.

## Verification

- `npm run typecheck`
- focused verified-by suite
- `npm test`
- `npm run security:static` / `security:backend` / `design:static`
- `npm run supabase:test` — not run in this environment when Docker is unavailable
