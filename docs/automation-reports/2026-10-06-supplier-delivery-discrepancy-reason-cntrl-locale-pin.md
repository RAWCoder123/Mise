# MISE-005IS: supplier_delivery_items.discrepancy_reason cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-supplier-delivery-discrepancy-reason-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.supplier_delivery_items.discrepancy_reason` remained length-only
(`null or length <= 500`) with no control-character CHECK. Sibling reason
gates (`inventory_events.reason_code` #624, `mise_actions.reason` #579) already
pin ASCII C `[[:cntrl:]]` rejection. Under locale drift, dump/restore can
disagree with those sibling gates on receive-line discrepancy text.

## Fix

Additive migration
`20261007050000_mise_005is_supplier_delivery_discrepancy_reason_cntrl_locale_pin.sql`
reattaches `supplier_delivery_items_reason_bound_check`:

```sql
discrepancy_reason is null
or (
  length(discrepancy_reason) <= 500
  and discrepancy_reason collate "C" !~ '[[:cntrl:]]'
)
```

Exact length bound and nullability are preserved; only the missing cntrl gate
is added under COLLATE `"C"`.

## Out of scope

- Does not rewrite receive RPCs or `supplier_deliveries.notes`
- Does not rewrite `client_delivery_id` (#458), `inventory_events.reason_code`
  (#624), or `mise_actions.reason` (#579)
- Does not touch canonical_unit enum pins

## Compose

Alone-OK on main versus #458/#624/#579 and open receive stacks. Timestamp after
MISE-005IR (#660).

## Verification

- `npm run typecheck`
- focused `tests/supplierDeliveryDiscrepancyReasonCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan=10 from 10 assertion call sites); not executed
  here when Docker unavailable
