# MISE-005IU: supplier_recipients.email shape locale pin

## Summary

Additive CHECK-only migration reattaches
`supplier_recipients_email_format_check` as

```sql
email is null or (
  pg_catalog.length(email) between 3 and 254
  and email = pg_catalog.btrim(email)
  and email collate "C" !~ '[[:cntrl:]]'
  and email collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
)
```

Foundation left cntrl and mailbox-shape `[[:space:]]` on bare `email`.
MISE-005K (#419) pins cntrl under COLLATE "C" but leaves the positive shape
`~` unpinned. Sibling mailbox tips pin shape as `email collate "C" ~`. This
tip closes that restore hazard for the durable supplier-send To mailbox.

## Scope

- CHECK-only; does not rewrite `upsert_supplier_recipient` or setup RPCs
- Leaves `supplier_recipients_name_bounds_check` (#419) untouched
- Alone-OK on main; field-level conflict with #419 `email_format` reattach —
  land after #419 or rebase #419 to keep `name_bounds` only

## Verification

- `npm run typecheck` — pass
- focused `supplierRecipientsEmailShapeLocalePin` — 4/4 pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` withTimeout hang)
- pgTAP plan 12 from 12 assertion call sites (Docker/pgTAP unavailable)
