# MISE-005FH: activity_events.related_entity_type cntrl locale pin

## Summary

Additive CHECK-only migration attaches `activity_events_related_entity_type_check`
as null OR `length(trim(related_entity_type)) between 1 and 80` plus
`related_entity_type collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. The `record_activity`
writer already normalizes with `nullif(left(trim(...), 80), '')`; this tip
locks that bound and closes LC_CTYPE dump/restore drift for activity
entity-type labels.

## Scope

- CHECK-only; does not rewrite activity RPCs or writers
- Leaves title (#560), summary (#564), source (#567), trigger_type (#568),
  idempotency_key (#569), trigger_reference (#571), related_entity_id,
  restaurant_memories.*, and operational_issues.* untouched

## Verification

- `npm run typecheck`
- focused `activityEventsRelatedEntityTypeCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
