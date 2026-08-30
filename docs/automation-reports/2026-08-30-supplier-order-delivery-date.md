# Supplier order delivery date in message body (2026-08-30)

## Summary
Supplier order email/message bodies no longer hardcode `Delivery requested: Tomorrow morning`. They use the structured `delivery_date` (`YYYY-MM-DD`) with a stable fallback of `To be confirmed`, keeping demo TypeScript and hosted SQL builders aligned for MISE-003B send-content fingerprints. Order detail drafts now expose a delivery-date editor.

## Changes
- Domain: `formatSupplierOrderDeliveryLine` + `buildSupplierOrderMessage(..., deliveryDate)`
- Demo rebuild on note or delivery-date update; demo seed messages use real date keys
- Hosted migration `20260830001000_supplier_order_delivery_date_message.sql` updates `private.build_supplier_order_message`, makes `build_supplier_send_content` call it for `expected_body`, and backfills draft bodies
- UI: `/orders/[id]` draft delivery date field + save draft persistence (with note)
- i18n EN/ES/zh-Hans for delivery editor and draft save notices
- Presentation: `Due {date}` instead of `Due tomorrow morning`

## Verification
- `npm run typecheck` passed
- `npm test` 636 passed / 0 failed (7 cancelled inherited recalculation timeout flakes)
- `npm run security:static` passed
- `npm run security:backend` passed
- Focused coverage in `tests/supplierOrderDeliveryDateMessage.test.ts`

## Follow-ups
- Locale-aware supplier send template labels (EN/ES/zh-Hans) with fingerprint parity
- Guard Log Delivery vs order Mark received double-count
- Deploy additive migration to staging
