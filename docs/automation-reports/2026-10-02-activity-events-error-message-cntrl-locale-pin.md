# MISE-005FQ: activity_events.error_message cntrl locale pin

## Summary

CHECK-only locale pin for durable activity_events error_message prose:

- Add `activity_events_error_message_check` — `error_message is null` or `length(trim(error_message)) between 1 and 1000` plus multiline-aware ASCII control rejection under COLLATE `"C"`:
  `error_message collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
- Operator-facing free-form-ish failure prose; allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` / operator_note / correction / activity summary / mise_actions.error_message). Rejects other C0 controls and DEL.
- Bound rationale: foundation writers persist
  `nullif(left(trim(p_error_message), 1000), '')`
  and the supplier-send failure recorder also passes
  `left(trim(p_error_message), 1000)`
  into activity. 1000 locks the existing writer truncation contract and matches the established free-form prose window.

Does not rewrite activity RPCs, title (#560), summary (#564), source (#567), trigger_type (#568), idempotency_key (#569), trigger_reference (#571), related_entity_type (#572), related_entity_id (#573), sequence_id (#574), error_code (#575), or mise_actions.error_message (#580).

## Verification

- `npm run typecheck` — passed
- focused `activityEventsErrorMessageCntrlLocalePin` — 4/4 passed
- `npm test` — 680 passed, 0 failed, 7 cancelled
- pgTAP plan **15** counted from 15 assertion call sites (Docker unavailable in this environment)
