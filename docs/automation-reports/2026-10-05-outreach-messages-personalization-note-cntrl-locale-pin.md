# MISE-005HS: outreach_messages.personalization_note cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_messages_personalization_note_check` as
`char_length(btrim(personalization_note)) between 1 and 500` plus
multiline-aware ASCII control rejection under COLLATE `"C"`:

`personalization_note collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

The foundation column was
`personalization_note text not null check (char_length(btrim(personalization_note)) between 1 and 500)`
with no control-character gate. This tip locks that length bound under
COLLATE `"C"` so dump/restore cannot accept personalization-note bytes a
restored C-locale path would refuse.

`personalization_note` is classified as free-form multiline draft rationale
prose, not a single-line title. The tip allows LF/TAB/CR (same class as
`unsafeSupplierSendMultilineControlPattern` / operator_note #551 /
order_message #619 / value_proposition #634 / audience_description #633) and
rejects other C0 controls and DEL.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `subject`, `body_text`, `body_html`, `status` (#519 / MISE-005DT),
  `generation_provider`, `idempotency_key`, `provider_message_id`, and
  `last_error` untouched
- Alone-OK versus open #634 / #633 / #632 / #631 / #630 / #629 / #628 and
  untipped sibling message body fields on the same table

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesPersonalizationNoteCntrlLocalePin` — 4/4 passed
- `npm test` — 687 total; 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` timer cancel flake; new tip assertions all pass)
- pgTAP plan **16** counted from 16 assertion call sites (Docker/pgTAP
  unavailable in this environment)
