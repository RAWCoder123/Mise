# MISE-005GP: supplier_order_confirmations.source cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`supplier_order_confirmations_source_check` as
`length(trim(source)) between 1 and 80` plus
`source collate "C" !~ '[[:cntrl:]]'`.

The foundation column was `source text not null check (length(trim(source)) between 1 and 80)`
with no control-character gate. Hosted
`private.service_record_supplier_confirmation` already stores
`left(trim(p_source), 80)`. This tip locks that length bound under COLLATE "C"
so dump/restore cannot accept confirmation-source label bytes a restored
C-locale path would refuse.

`source` is classified as a single-line integration/system label
(e.g. provider channel names), not free-form multiline prose.

## Scope

- CHECK-only; does not rewrite `service_record_supplier_confirmation`
- Leaves confirmation_status (#513), idempotency_key (#459),
  confirmation_reference (#604), and details_bound_check untouched
- Alone-OK versus open #513 / #459 / #604 (different columns on the same table)

## Verification

- `npm run typecheck` passed
- focused `supplierOrderConfirmationsSourceCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
