# MISE-005N: pin supplier recipient email shape to COLLATE C

Branch: `cursor/mise-supplier-recipient-email-locale-pin`  
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20260926083000_mise_005n_supplier_recipient_email_locale_pin.sql`
  - Reattach `supplier_recipients_email_format_check` with
    `email collate "C" !~ '[[:cntrl:]]'` and
    `email collate "C" ~ '^[^[:space:]@]+@...'`
  - Rewrite `public.upsert_supplier_recipient(uuid, uuid, text)` so email
    `lower(btrim(...))`, cntrl, and shape fail-closed match COLLATE `"C"`
- Domain: `normalizeSupplierRecipientEmail` / `SUPPLIER_RECIPIENT_EMAIL_SHAPE`
  (ASCII C space set + A-Z fold only) in `requireSupplierRecipientInput`
- Source-pin Jest + committed pgTAP fixture

## Why

MISE-005K pinned recipient cntrl CHECKs but left address-shape `[[:space:]]`
and the upsert RPC on bare ctype-dependent classes/`lower()`. Dump/restore and
write-path fail-closed can diverge when `LC_CTYPE` drifts.

## Out of scope

- `supplier_recipients_name_bounds_check` (MISE-005K)
- Setup-save bulk recipient RPCs
- Landing/rebasing open stacks #348–#421
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
