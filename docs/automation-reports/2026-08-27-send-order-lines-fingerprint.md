# Supplier send fingerprint from durable order lines

Date: 2026-08-27  
Branch: `cursor/mise-send-order-lines-fingerprint` (stale)  
Stacked on: `cursor/mise-receive-order-lines` (#197) → `cursor/mise-supplier-order-lines` (#196)

## Status

Superseded by the 2026-11-05 main rebase tip:
`docs/automation-reports/2026-11-05-send-order-lines-fingerprint-main-rebase.md`
(`cursor/mise-send-order-lines-fingerprint-main-rebase`, stacked on #1109).

## Summary

Supplier-send preview/approval fingerprints now bind durable `supplier_order_lines`
quantities instead of live `purchase_recommendations.recommended_quantity`. The
`mise.supplier_send.v2` snapshot schema is unchanged; only the authority source moves.

## Behavior

- Missing durable lines → `order_lines_missing` (no recommendation rebuild)
- Lines without `purchase_recommendation_id` or invalid qty/name/unit → `send_content_invalid`
- Expected `order_message` body is rebuilt from durable lines for equality checks
- Line supplier identity in the fingerprint comes from the order (durable supplier ID)

## Paths (stale timestamps)

- `supabase/migrations/20260827030000_supplier_send_order_lines_fingerprint.sql`
  (rebased tip uses `20261105090000_…`)
- `supabase/tests/database/supplier_send_order_lines_fingerprint.test.sql`
- `services/domain/supplierSendContent.ts`
- `services/repositories/demoRepository.ts`
- `tests/supplierSendOrderLinesFingerprint.test.ts`
- `docs/pilot/FIRST_RESTAURANT_GAP_AUDIT.md`
