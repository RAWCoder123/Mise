# Claim RFC Message-Id cntrl locale pin (MISE-005S) — 2026-09-26

## Summary

Pin `private.service_claim_supplier_email_send` so the RFC Message-Id
control-character preflight uses `p_rfc_message_id collate "C" ~ '[[:cntrl:]]'`.
Preserve the MISE-005R credential↔connection sender identity compare so this
tip is safe alone or after #426.

## Why

Bare POSIX `[[:cntrl:]]` follows database `LC_CTYPE`. MISE-005J pinned the
`supplier_email_deliveries.rfc_message_id` CHECK; claim still preflighted with
an unpinned class. Locale drift can make claim accept a Message-Id the CHECK
rejects (or refuse one the CHECK accepts), breaking claim→store continuity.

## Scope

- Additive migration `20260926133000_mise_005s_claim_rfc_message_id_cntrl_locale_pin.sql`
- Source-pin Jest + committed pgTAP fixture (`plan(5)` from assertion call sites)
- Does **not** reattach gmail / claimed-envelope / rfc CHECK constraints
- Does **not** rewrite `build_supplier_send_content` or complete-send
  `p_provider_message_id` preflight

## Compose

Timestamp after MISE-005R (`20260926123000`). Prefer apply after #426 / #418.
Compose-safe with MISE-005J/005O/005P/005Q (no shared CHECK reattach).

## Verification

- `npm run typecheck`
- focused `tests/claimRfcMessageIdCntrlLocalePin.test.ts`
- `npm test`
- pgTAP committed; Docker/pgTAP unavailable in this environment
