# MISE-005HT: outreach_messages.body_text cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_messages_body_text_check` as
`char_length(btrim(body_text)) between 1 and 4000` plus
multiline-aware ASCII control rejection under COLLATE `"C"`:

`body_text collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

The foundation column was
`body_text text not null check (char_length(btrim(body_text)) between 1 and 4000)`
with no control-character gate. This tip locks that length bound under
COLLATE `"C"` so dump/restore cannot accept body-text bytes a
restored C-locale path would refuse.

`body_text` is classified as free-form multiline plain-text email body
prose, not a single-line title. The tip allows LF/TAB/CR (same class as
`unsafeSupplierSendMultilineControlPattern` / operator_note #551 /
order_message #619 / personalization_note #635 / value_proposition #634) and
rejects other C0 controls and DEL.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `subject`, `body_html`, `personalization_note` (#635 / MISE-005HS),
  `status` (#519 / MISE-005DT), `generation_provider`, `idempotency_key`,
  `provider_message_id`, and `last_error` untouched
- Alone-OK versus open #635 / #634 / #633 / #632 / #631 / #630 / #629 / #628
  and untipped sibling message body_html / subject fields on the same table

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesBodyTextCntrlLocalePin` — 4/4 passed
- `npm test` — 687 total; 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` timer cancel flake; new tip assertions all pass)
- pgTAP plan **16** counted from 16 assertion call sites (Docker/pgTAP
  unavailable in this environment)
