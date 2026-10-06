# MISE-005JB: supplier_deliveries.notes cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-supplier-deliveries-notes-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.supplier_deliveries.notes` remained length-only
(`null or length <= 2000`) with no control-character CHECK. Sibling receive
tip MISE-005IS (#661) pinned `discrepancy_reason` under ASCII C `[[:cntrl:]]`,
and MISE-005EM (#551) pinned multiline `supplier_orders.operator_note` with the
supplier-send allowlist. Delivery header notes stayed length-only. Under locale
drift, dump/restore can disagree with those sibling gates on receive evidence
text.

## Fix

Additive migration
`20261008010000_mise_005jb_supplier_deliveries_notes_cntrl_locale_pin.sql`
reattaches `supplier_deliveries_notes_bound_check`:

```sql
notes is null
or (
  length(notes) <= 2000
  and notes collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
)
```

Exact length bound and nullability are preserved. Notes are multiline
free-form receive evidence, so the gate allows LF/TAB/CR and rejects other C0
controls and DEL — the same byte class as
`unsafeSupplierSendMultilineControlPattern` / MISE-005EM — not full
`[[:cntrl:]]`.

## Out of scope

- Does not rewrite receive RPCs or `supplier_delivery_items.discrepancy_reason`
  (#661)
- Does not rewrite `client_delivery_id` (#458), `supplier_orders.operator_note`
  (#551), or `supplier_deliveries.status` (#514)
- Does not modify `services/miseValidation.ts` (shares existing multiline class)

## Compose

Alone-OK on main versus #661/#551/#458/#514 and open receive stacks. Timestamp
after MISE-005IY (#667).

## Verification

- `npm run typecheck`
- focused `tests/supplierDeliveriesNotesCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan=14 from 14 assertion call sites); not executed
  here when Docker unavailable
