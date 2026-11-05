# Supplier send fingerprint from durable order lines (main rebase)

Date: 2026-11-05  
Branch: `cursor/mise-send-order-lines-fingerprint-main-rebase`  
Stacked on: `cursor/mise-receive-order-lines-main-rebase` (#1109) →
`cursor/mise-supplier-order-lines-main-rebase` (#1108) → `origin/main`  
Supersedes: stale #198 (`cursor/mise-send-order-lines-fingerprint`)

## Summary

Cherry-picked #198 onto the current #1109 tip and retimed the additive migration
to `20261105090000_supplier_send_order_lines_fingerprint.sql` so it runs after
`20261105080000_supplier_order_lines.sql` on the rebased stack.

Supplier-send preview/approval fingerprints bind durable `supplier_order_lines`
quantities instead of live `purchase_recommendations.recommended_quantity`. The
`mise.supplier_send.v2` snapshot schema is unchanged; only the authority source
moves.

## Behavior

- Missing durable lines → `order_lines_missing` (no recommendation rebuild)
- Lines without `purchase_recommendation_id` or invalid qty/name/unit →
  `send_content_invalid`
- Expected `order_message` body is rebuilt from durable lines for equality checks
- Line supplier identity in the fingerprint comes from the order (durable
  supplier ID)

## Paths

- `supabase/migrations/20261105090000_supplier_send_order_lines_fingerprint.sql`
- `supabase/tests/database/supplier_send_order_lines_fingerprint.test.sql`
- `services/domain/supplierSendContent.ts`
- `services/repositories/demoRepository.ts`
- `tests/supplierSendOrderLinesFingerprint.test.ts`
- `tests/supplierSendOrderLinesFingerprintMigration.test.ts`
- `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`

## Land notes

Do not merge stale #198. Prefer this tip after #1109. Ordinary conflicts expected
with open supplier-send locale/ASCII-C tips that also replace
`private.build_supplier_send_content`.

## Verification

Recorded in the tip PR description after local gates run.
