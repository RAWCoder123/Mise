# MISE-005HX: outreach_messages.last_error cntrl locale pin

## Summary

CHECK-only locale pin for durable outreach message delivery failure labels:

- Add `outreach_messages_last_error_check` — `last_error is null` or `length(trim(last_error)) between 1 and 80` plus full ASCII control rejection under COLLATE `"C"`:
  `last_error collate "C" !~ '[[:cntrl:]]'`
- Single-line Resend/webhook lifecycle labels (`provider_delivery_failed`, `resend_http_*`, `hard_bounce`, …). Rejects LF/TAB/CR/NUL/DEL.
- Bound rationale: sibling `error_code` / `last_error_code` windows use 80; current writers persist short snake_case labels with no free-form prose path into this column.

Does not rewrite outreach-agent / outreach-webhook writers. Leaves subject (#638), body_html (#637), body_text (#636), personalization_note (#635), provider_message_id (#470), and `outreach_agent_runs.error_summary` untouched.

## Alone-OK

Safe to land independently of open #639 event_type, #638–#628 message/campaign tips, #470 provider_message_id, and #469 provider_event_id.

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesLastErrorCntrlLocalePin` — 3/3 passed
- `npm test` — 686 total; 679 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)
- pgTAP plan **13** counted from 13 assertion call sites (Docker unavailable here)
