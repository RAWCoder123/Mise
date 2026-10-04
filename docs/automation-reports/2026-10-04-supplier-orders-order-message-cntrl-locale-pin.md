# MISE-005HC: supplier_orders.order_message cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`supplier_orders_message_size_check` with its existing
`octet_length(order_message) <= 65536` bound, plus multiline-aware ASCII
control rejection under `COLLATE "C"`:

- reject U+0000–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F
- allow LF / TAB / CR — matching `unsafeSupplierSendMultilineControlPattern`

`supplier_orders_operational_values_check` (non-empty trim for supplier_name
and order_message) is left intact so this tip stays alone-OK versus open
`supplier_name` (#612) and `operator_note` (#551) pins. Client
`requireSupplierSendBody` already shares the same multiline control allowlist.

## Scope

- CHECK-only; does not rewrite supplier-send builders or draft-update RPCs
- Leaves operational_values_check, operator_note, supplier_name, and
  provider_message_id untouched
- Alone-OK versus open #618 / #617 / #616 / #615 / #614 / #613 / #612 / #551

## Verification

- `npm run typecheck` — passed
- focused `supplierOrdersOrderMessageCntrlLocalePin` — 4/4 passed
- `npm test` — 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan **15** counted from 15 assertion call sites in
  `supplier_orders_order_message_cntrl_locale_pin.test.sql`
  (Docker/pgTAP unavailable in this environment)
