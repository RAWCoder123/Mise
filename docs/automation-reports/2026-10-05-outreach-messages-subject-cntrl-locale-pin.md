# MISE-005HV: outreach_messages.subject cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_messages_subject_check` as
`char_length(btrim(subject)) between 1 and 78` plus
`subject collate "C" !~ '[[:cntrl:]]'`.

The foundation column was
`subject text not null check (char_length(btrim(subject)) between 1 and 78)`
with no control-character gate. This tip locks that length bound under
COLLATE "C" so dump/restore cannot accept subject bytes a restored
C-locale path would refuse.

`subject` is classified as a single-line email subject, not free-form
multiline prose. Rejecting LF/TAB/CR/NUL keeps subjects stable across restore
and blocks control-character injection at the database boundary.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `body_text` (#636), `body_html` (#637), `personalization_note` (#635),
  `status` (#519 / MISE-005DT), `generation_provider`, `idempotency_key`,
  `provider_message_id`, and `last_error` untouched
- Alone-OK versus open #637 / #636 / #635 / #634–#628 and untipped sibling
  message fields on the same table

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesSubjectCntrlLocalePin` — 4/4 passed
- `npm test` — 687 total; 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` timer cancel flake; new tip assertions all pass)
- pgTAP plan **14** from 14 assertion call sites (Docker/pgTAP unavailable
  in this environment)
