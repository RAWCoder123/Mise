# MISE-005P: pin claimed_from/claimed_to lower + mailbox shape to COLLATE C

Branch: `cursor/mise-claimed-envelope-email-locale-pin`  
Base: `origin/main` @ `78da737`

## Change

- Additive migration `20260926103000_mise_005p_claimed_envelope_email_locale_pin.sql`
  - Reattach `supplier_email_deliveries_mise_003c_metadata_check` so
    `claimed_from` / `claimed_to` require:
    - `btrim`
    - `lower(... collate "C") collate "C"`
    - `collate "C" !~ '[[:cntrl:]]'`
    - `collate "C" ~ '^[^[:space:]@]+@...'` mailbox shape
  - Keep `claimed_subject` on COLLATE `"C"` cntrl rejection
  - Preserve the rest of the MISE-003C metadata contract
- Source-pin Jest + committed pgTAP fixture (plan derived from assertion call sites)

## Why

MISE-005J pinned envelope cntrl CHECKs but left claimed From/To on bare
`lower(btrim(...))` with no mailbox shape. Dump/restore and claim durability
can diverge when `LC_CTYPE` drifts; a non-mailbox string could also survive
restore as a claimed address.

## Out of scope

- `gmail_credentials.sender_email` (MISE-005O)
- `rfc_message_id` CHECK (MISE-005J)
- Claim / approve / complete send RPC rewrites
- Landing/rebasing open stacks #348–#423
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration

## Compose note

Timestamp `20260926103000` is after MISE-005J (`20260926042000`) and
MISE-005O (`20260926093000`). When both 005J and 005P land, apply 005P last so
005J cannot wipe the shape pins. 005P includes the 005J cntrl pins for
claimed_from/to/subject so a solo land is still correct.
