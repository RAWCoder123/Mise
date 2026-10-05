# MISE-005IE: outreach_messages.model_name cntrl locale pin

## Summary

CHECK-only locale pin for durable outreach generation model labels:

- Add `outreach_messages_model_name_check` — `model_name is null` or `length(trim(model_name)) between 1 and 80` plus full ASCII control rejection under COLLATE `"C"`:
  `model_name collate "C" !~ '[[:cntrl:]]'`
- Single-line OpenAI model ids from `OPENAI_OUTREACH_MODEL` (default `gpt-5.6`) or null for `deterministic_fallback`. Rejects LF/TAB/CR/NUL/DEL.
- Bound rationale: sibling `last_error` / `error_code` windows use 80; current writer inserts `generated.model` without an explicit Edge length gate — CHECK-only tip preferred.

Does not rewrite outreach-agent writers. Leaves subject (#638), body_html (#637), body_text (#636), personalization_note (#635), last_error (#640), provider_message_id (#470), and generation_provider (#525) untouched.

## Alone-OK

Safe to land independently of open #646 cuisine, #645–#628 lead/campaign tips, #640 last_error, #525 generation_provider, and #470 provider_message_id.

## Verification

- `npm run typecheck` — passed
- focused `outreachMessagesModelNameCntrlLocalePin` — 3/3 passed
- `npm test` — 686 total; 679 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)
- pgTAP plan **13** counted from 13 assertion call sites (Docker unavailable here)
