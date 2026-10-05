# MISE-005HW: outreach_events.event_type cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_events_event_type_check` as
`char_length(btrim(event_type)) between 1 and 100` plus
`event_type collate "C" !~ '[[:cntrl:]]'`.

The foundation column was
`event_type text not null check (char_length(btrim(event_type)) between 1 and 100)`
with no control-character gate. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept event_type bytes a restored
C-locale path would refuse.

`event_type` is classified as a single-line Resend/Svix delivery lifecycle
label (for example `email.delivered`), not free-form multiline prose.
Rejecting LF/TAB/CR/NUL keeps event labels stable across restore and blocks
control-character injection at the database boundary.

## Scope

- CHECK-only; does not rewrite outreach-webhook or Edge Functions
- Leaves `provider_event_id` (#469 / MISE-005BI), `provider_message_id`
  (#470 / MISE-005BJ), and outreach message/campaign/lead tips untouched
- Alone-OK versus open #469 / #470 / #638–#628

## Verification

- `npm run typecheck` — pending in this report until local run completes
- focused `outreachEventsEventTypeCntrlLocalePin` — pending
- `npm test` — pending
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP typically
  unavailable in this environment)
