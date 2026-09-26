# MISE-005J: pin supplier-send / Gmail delivery envelope cntrl CHECKs to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-supplier-send-envelope-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.gmail_credentials.sender_email` and `private.supplier_email_deliveries`
(`rfc_message_id` plus claimed From / To / Subject on the MISE-003C metadata
CHECK) still used bare POSIX `[[:cntrl:]]`, which follows database `LC_CTYPE`.
MISE-005A already proved locale drift on this cluster for `lower()` /
`[[:alnum:]]`; MISE-005B through MISE-005I re-pinned sibling text identity
columns with `collate "C" !~ '[[:cntrl:]]'`.

These envelope fields are the durable From / To / Subject / Message-ID claim on
every supplier send. If a glibc/ICU change reclassified a stored byte under
bare `[[:cntrl:]]`, `pg_dump`/`restore` could reject delivery claim rows the
source accepted — breaking send-completion and audit continuity.

## Change

- Additive migration `20260926042000_mise_005j_supplier_send_envelope_cntrl_locale_pin.sql`
  - Reattach `gmail_credentials_sender_email_check` with
    `sender_email collate "C" !~ '[[:cntrl:]]'`
  - Reattach `supplier_email_deliveries_rfc_message_id_check` with
    `rfc_message_id collate "C" !~ '[[:cntrl:]]'`
  - Reattach `supplier_email_deliveries_mise_003c_metadata_check` with
    `claimed_from` / `claimed_to` / `claimed_subject` COLLATE C cntrl rejection
    while preserving the MISE-003C metadata contract
- Source-pin + pgTAP fixtures committed

Does **not** rewrite claim / approve / complete RPCs so this composes with open
supplier-send and Gmail stacks. Restore authority is the CHECK.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#417
- `public.supplier_recipients` name/email cntrl CHECKs (next sibling)
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
