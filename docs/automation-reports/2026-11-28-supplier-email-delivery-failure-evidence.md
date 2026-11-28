# Supplier email delivery failure evidence INSERT tip (2026-11-28)

## Gap

`private.supplier_email_deliveries.last_error_code` is nullable so sending /
sent rows can omit failure text. Soft table constraints only require provider
acceptance fields when `status = 'sent'`. Hosted fail / unknown transitions
stamp a bounded slug, but direct / SECURITY DEFINER inserts can still mint
`failed` or `unknown` deliveries with null or blank `last_error_code`. Client
and service_role DML are already revoked.

## Change

- Domain: `validateSupplierEmailDeliveryFailureEvidence` → `missing_last_error_code`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-error CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1322 and mise_actions failure evidence (#1305).
Existing fixtures INSERT sending / sent rows without `last_error_code`, and
failed / unknown fixture inserts already stamp a slug. Contested merge: none
expected — no fixture INSERTs a successful `failed`/`unknown` row without
failure text.

## Verification

- `npm run typecheck`
- focused supplier-email failure suite
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- Docker `npm run supabase:test` when available
