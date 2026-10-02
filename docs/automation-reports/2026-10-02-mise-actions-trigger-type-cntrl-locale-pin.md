# MISE-005FM: mise_actions.trigger_type cntrl locale pin

## Summary

Additive CHECK-only migration attaches `mise_actions_trigger_type_check`
as null OR `length(trim(trigger_type)) between 1 and 120` plus
`trigger_type collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. Writers pass system
label literals such as `'supplier_order_drafted'` without truncation; this tip
locks the same 120 bound used by the activity sibling writer and closes
LC_CTYPE dump/restore drift for action-ledger trigger labels (cntrl-only; does
not expand to a charset allowlist).

## Scope

- CHECK-only; does not rewrite mise_actions writers/triggers
- Leaves activity_events.trigger_type (#568), mise_actions.trigger_reference
  (#576), error_code (#441/#449), error_message, rollback_reference,
  idempotency_key (#457), and reason untouched

## Verification

- `npm run typecheck`: passed
- focused `miseActionsTriggerTypeCntrlLocalePin`: 3/3 passed
- `npm test`: 679 passed, 0 failed, 7 cancelled
- pgTAP plan(12) derived from 12 assertion call sites (Docker unavailable in this environment)
