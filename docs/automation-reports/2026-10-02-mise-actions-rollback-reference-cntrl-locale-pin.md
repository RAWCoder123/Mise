# MISE-005FN: mise_actions.rollback_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches `mise_actions_rollback_reference_check`
as null OR `length(trim(rollback_reference)) between 1 and 240` plus
`rollback_reference collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. Domain writers pass
trimmed rollback ID/ref strings via `markReversed` without truncation; this tip
locks the same 240 bound used by sibling action-ledger ID/ref columns
(`idempotency_key`, `trigger_reference`) and closes LC_CTYPE dump/restore drift
for action-ledger rollback references (cntrl-only; does not expand to a charset
allowlist).

## Scope

- CHECK-only; does not rewrite mise_actions writers/triggers
- Leaves mise_actions.trigger_type (#577), trigger_reference (#576),
  error_code (#441/#449), error_message, idempotency_key (#457), and reason
  untouched

## Verification

- `npm run typecheck`: passed
- focused `miseActionsRollbackReferenceCntrlLocalePin`: 3/3 passed
- `npm test`: 679 passed, 0 failed, 7 cancelled
- pgTAP plan(12) derived from 12 assertion call sites (Docker unavailable in this environment)
