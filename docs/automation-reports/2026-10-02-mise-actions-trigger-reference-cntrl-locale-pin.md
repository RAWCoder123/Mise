# MISE-005FL: mise_actions.trigger_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches `mise_actions_trigger_reference_check`
as null OR `length(trim(trigger_reference)) between 1 and 240` plus
`trigger_reference collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. Writers pass UUID text
via `new.id::text` / `orders.id::text` without truncation; this tip locks the
same 240 bound used by the activity sibling writer and closes LC_CTYPE
dump/restore drift for action-ledger correlation refs (cntrl-only; does not
expand to a charset allowlist).

## Scope

- CHECK-only; does not rewrite mise_actions writers/triggers
- Leaves activity_events.trigger_reference (#571), mise_actions.trigger_type,
  error_code (#441/#449), error_message, rollback_reference, idempotency_key
  (#457), and reason untouched

## Verification

- `npm run typecheck`: passed
- focused `miseActionsTriggerReferenceCntrlLocalePin`: 3/3 passed
- `npm test`: 679 passed, 0 failed, 7 cancelled
- pgTAP plan(12) derived from 12 assertion call sites (Docker unavailable in this environment)
