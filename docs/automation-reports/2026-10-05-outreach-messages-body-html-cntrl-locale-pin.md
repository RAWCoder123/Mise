# MISE-005HU: outreach_messages.body_html cntrl locale pin

## Summary

Additive CHECK-only migration reattaches
`outreach_messages_body_html_check` as
`char_length(btrim(body_html)) between 1 and 12000` plus
multiline-aware ASCII control rejection under COLLATE `"C"`:

`body_html collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

The foundation column was
`body_html text not null check (char_length(btrim(body_html)) between 1 and 12000)`
with no control-character gate. This tip locks that length bound under
COLLATE `"C"` so dump/restore cannot accept body-html bytes a
restored C-locale path would refuse.

`body_html` is classified as free-form multiline HTML email body
markup, not a single-line title. The tip allows LF/TAB/CR (same class as
`unsafeSupplierSendMultilineControlPattern` / operator_note #551 /
order_message #619 / personalization_note #635 / body_text #636 /
value_proposition #634) and rejects other C0 controls and DEL.

## Scope

- CHECK-only; does not rewrite outreach writers or Edge Functions
- Leaves `subject`, `body_text` (#636 / MISE-005HT),
  `personalization_note` (#635 / MISE-005HS), `status` (#519 / MISE-005DT),
  `generation_provider`, `idempotency_key`, `provider_message_id`, and
  `last_error` untouched
- Alone-OK versus open #636 / #635 / #634 / #633 / #632 / #631 / #630 / #629 /
  #628 and untipped sibling message subject field on the same table

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesBodyHtmlCntrlLocalePin` — 4/4 passed
- `npm test` — 687 total; 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` timer cancel flake; new tip assertions all pass)
- pgTAP plan **16** counted from 16 assertion call sites (Docker/pgTAP
  unavailable in this environment)
