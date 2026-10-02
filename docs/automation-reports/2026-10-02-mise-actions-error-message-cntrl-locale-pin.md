# MISE-005FP: mise_actions.error_message cntrl locale pin

## Summary

CHECK-only locale pin for durable mise_actions error_message prose:

- Add `mise_actions_error_message_check` — `error_message is null` or `length(trim(error_message)) between 1 and 1000` plus multiline-aware ASCII control rejection under COLLATE `"C"`:
  `error_message collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
- Operator-facing free-form-ish failure prose; allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` / operator_note / correction / activity summary / reason). Rejects other C0 controls and DEL.
- Bound rationale: foundation writers persist
  `left(trim(p_error_message), 1000)`
  and mint fixed sentences such as
  `The Gmail delivery result is uncertain and requires review.`
  Edge callers also `slice(0, 1000)` before RPC. 1000 locks the existing writer truncation contract and matches the established free-form prose window.

Does not rewrite mise_actions writers/triggers, reason (#579), rollback_reference (#578), trigger_type (#577), trigger_reference (#576), error_code (#441/#449), or idempotency_key (#457). Leaves activity_events.error_message for a separate tip.

## Verification

- `npm run typecheck` — passed
- focused `miseActionsErrorMessageCntrlLocalePin` — 4/4 passed
- `npm test` — 680 passed, 0 failed, 7 cancelled
- pgTAP plan **15** counted from 15 assertion call sites (Docker unavailable in this environment)
