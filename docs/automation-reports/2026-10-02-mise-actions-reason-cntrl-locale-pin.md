# MISE-005FO: mise_actions.reason cntrl locale pin

## Summary

CHECK-only locale pin for durable mise_actions reason prose:

- Add `mise_actions_reason_check` — `reason is null` or `length(trim(reason)) between 1 and 1000` plus multiline-aware ASCII control rejection under COLLATE `"C"`:
  `reason collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`
- Operator-facing free-form-ish sentence text; allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` / operator_note / correction / activity summary). Rejects other C0 controls and DEL.
- Bound rationale: foundation writers mint
  `format('Send the prepared %s supplier order after owner or manager approval.', supplier_name)`
  with supplier display names capped at 160 characters (~226 chars total). 1000 matches the established free-form prose window used by correction/summary tips and leaves headroom for similar future format() writers without rewriting them.

Does not rewrite mise_actions writers/triggers, rollback_reference (#578), trigger_type (#577), trigger_reference (#576), error_code (#441/#449), error_message, or idempotency_key (#457).

## Verification

- `npm run typecheck` — passed
- focused `miseActionsReasonCntrlLocalePin` — 4/4 passed
- `npm test` — 680 passed, 0 failed, 7 cancelled
- pgTAP plan **15** counted from 15 assertion call sites (Docker unavailable in this environment)
