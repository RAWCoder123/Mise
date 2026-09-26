# MISE-005O: pin Gmail sender_email shape + OAuth fail-closed to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-gmail-sender-email-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.gmail_credentials.sender_email` still validated with bare
`lower(sender_email)` and bare `[[:cntrl:]]`, and had no mailbox shape.
`private.service_complete_gmail_oauth` mirrored that with bare
`lower(trim(...))`, bare `[[:cntrl:]]`, and bare `[[:space:]]` shape.
`lower()` and POSIX classes follow database `LC_CTYPE`. MISE-005A proved
locale drift on this cluster; MISE-005J re-pinned only the cntrl half of this
CHECK.

`sender_email` is the durable Gmail From on every connected restaurant. Locale
drift could make dump/restore reject credential rows the source accepted, or
let OAuth accept a mailbox the CHECK would reject — breaking reconnect and
supplier-send From continuity.

## Change

- Additive migration `20260926093000_mise_005o_gmail_sender_email_locale_pin.sql`
  - Reattach `gmail_credentials_sender_email_check` with COLLATE C lower,
    cntrl, and `[[:space:]]` mailbox shape (plus trim equality)
  - Rewrite `private.service_complete_gmail_oauth` fail-closed to the same
    contract; preserve service_role execute grant
- Edge `_shared/gmail.ts`: export `GMAIL_SENDER_EMAIL_SHAPE` /
  `normalizeGmailSenderEmail` / `foldAsciiUpperCase` (A-Z fold, ASCII C space)
  and use them from `normalizeEmail`
- Source-pin Jest + committed pgTAP fixture

## Scope boundaries

- Does **not** rewrite `supplier_email_deliveries` metadata / rfc_message_id
  CHECKs (MISE-005J)
- Does **not** rewrite claim / approve / complete send RPCs
- Does **not** touch `supplier_recipients` (#419/#422)
- Does **not** invent MOQ / lead_time / expiration

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment
