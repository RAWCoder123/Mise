# MISE-005R: claim credential email locale pin

**Date:** 2026-09-26  
**Branch:** `cursor/mise-claim-credential-email-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Problem

`private.service_claim_supplier_email_send` compared durable Gmail credential
`sender_email` to `lower(btrim(connection.sender_email))` without `COLLATE "C"`.
`lower()` follows database `LC_CTYPE`. After locale drift, claim could refuse a
connected mailbox that OAuth / `gmail_credentials` CHECK accepted (or the
reverse), breaking supplier-send claim continuity.

MISE-005O pinned credential storage and OAuth fail-closed; MISE-005Q pinned
build From/To/subject. The claim identity compare remained bare.

## Change

Additive migration `20260926123000_mise_005r_claim_credential_email_locale_pin.sql`:

- Rewrites `private.service_claim_supplier_email_send` so the credential
  identity gate uses
  `lower(btrim(connection.sender_email) COLLATE "C") COLLATE "C"`.
- Preserves service_role EXECUTE; revokes public/anon/authenticated.
- Does **not** rewrite build content (#425), gmail_credentials CHECK (#423),
  or claimed-envelope CHECK (#424).

## Verification

- `npm run typecheck`
- Focused: `tests/claimCredentialEmailLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (Docker/pgTAP unavailable in this environment)

## Compose

Must apply after MISE-003C. Compose-safe with MISE-005O/005P/005Q (no shared
CHECK reattach; does not rewrite those functions).
