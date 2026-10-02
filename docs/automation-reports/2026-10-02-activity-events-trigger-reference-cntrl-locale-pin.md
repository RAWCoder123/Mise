# MISE-005FG: activity_events.trigger_reference cntrl locale pin

## Summary

Additive CHECK-only migration attaches `activity_events_trigger_reference_check`
as null OR `length(trim(trigger_reference)) between 1 and 240` plus
`trigger_reference collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. The `record_activity`
writer already normalizes with `nullif(left(trim(...), 240), '')`; this tip
locks that bound and closes LC_CTYPE dump/restore drift for activity
correlation refs.

## Scope

- CHECK-only; does not rewrite activity RPCs or writers
- Leaves title (#560), summary (#564), source (#567), trigger_type (#568),
  idempotency_key (#569), restaurant_memories.* (#570/#566/#565/#563), and
  `mise_actions.trigger_reference` untouched

## Verification

- `npm run typecheck`
- focused `activityEventsTriggerReferenceCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
