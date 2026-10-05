# MISE-005IG: supplier_email_deliveries.last_error_code cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`supplier_email_deliveries_last_error_code_check` as null OR
`length(last_error_code) between 1 and 80` plus
`last_error_code collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with a length-only CHECK. Writers
already normalize through `private.gmail_safe_error_code` or assign fixed
ASCII tokens; this tip preserves the length window and closes LC_CTYPE
dump/restore drift for private Gmail supplier-send failure labels.

## Scope

- CHECK-only; does not rewrite Gmail OAuth/send RPCs or `gmail_safe_error_code`
- Leaves status (#533), provider_message_id (#444), rfc_message_id (#418),
  sent_check, and mise_003c metadata untouched
- Does not expand to `^[a-z0-9_]{1,80}$` charset allowlist (cntrl-only)

## Verification

- `npm run typecheck`
- focused `supplierEmailDeliveriesLastErrorCodeCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
