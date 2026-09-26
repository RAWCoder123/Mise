# MISE-005T: complete-send provider_message_id cntrl locale pin

**Date:** 2026-09-26  
**Branch:** `cursor/mise-complete-send-provider-message-id-cntrl-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Change

Additive migration `20260926140000_mise_005t_complete_send_provider_message_id_cntrl_locale_pin.sql` rewrites `private.service_complete_supplier_email_send` so the provider message id control-character preflight uses:

```sql
p_provider_message_id collate "C" ~ '[[:cntrl:]]'
```

instead of bare `[[:cntrl:]]` (which follows database `LC_CTYPE`).

## Why

MISE-005A proved locale drift on this cluster. Claim/rfc Message-Id gates were pinned in MISE-005J/005S, but complete-send still used an unpinned cntrl preflight. Drift could accept a provider id a restored C-locale gate would reject (or refuse one it would accept), breaking claim→complete continuity for the same Gmail provider message id bytes.

## Out of scope

- Does not rewrite claim (`service_claim_supplier_email_send` / MISE-005S)
- Does not reattach envelope/rfc/gmail CHECKs (MISE-005J/005O/005P)
- Does not rewrite `build_supplier_send_content` (MISE-005Q)
- Preserves `service_role` EXECUTE; public/anon/authenticated revoked

## Compose

Must apply after MISE-003C. Prefer after MISE-005S (#427) so claim+complete pins land together. Compose-safe alone on main; no shared CHECK reattach with #418–#426.

## Verification

- Static tests in `tests/completeSendProviderMessageIdCntrlLocalePin.test.ts`
- pgTAP fixture committed (not executed here without Docker)
