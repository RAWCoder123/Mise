# MISE-005GN: supplier_order_confirmations.confirmation_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches
`supplier_order_confirmations_confirmation_reference_check` as null OR
`length(trim(confirmation_reference)) between 1 and 512` plus
`confirmation_reference collate "C" !~ '[[:cntrl:]]'`.

The backbone column was nullable text with no length or cntrl gate. Hosted
`private.service_record_supplier_confirmation` already stores
`nullif(left(trim(p_confirmation_reference), 512), '')`. This tip locks that
length bound under COLLATE "C" so dump/restore cannot accept vendor
confirmation-reference bytes a restored C-locale path would refuse.

`confirmation_reference` is classified as a single-line vendor confirmation
reference (PO ack numbers / vendor confirmation IDs), not free-form multiline
prose.

## Scope

- CHECK-only; does not rewrite `service_record_supplier_confirmation`
- Leaves confirmation_status (#513), idempotency_key (#459), source, and
  details_bound_check untouched
- Alone-OK versus open #513 / #459 (different columns on the same table)

## Verification

- `npm run typecheck` passed
- focused `supplierConfirmationReferenceCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` withTimeout hang)
- pgTAP plan 14 from 14 assertion call sites (Docker/pgTAP unavailable in this environment)
