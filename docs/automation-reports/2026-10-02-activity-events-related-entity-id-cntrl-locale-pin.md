# MISE-005FI: activity_events.related_entity_id cntrl locale pin

## Summary

Additive CHECK-only migration attaches `activity_events_related_entity_id_check`
as null OR `length(trim(related_entity_id)) between 1 and 240` plus
`related_entity_id collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. The `record_activity`
writer already normalizes with `nullif(left(trim(...), 240), '')`; this tip
locks that bound and closes LC_CTYPE dump/restore drift for activity
system entity IDs.

## Scope

- CHECK-only; does not rewrite activity RPCs or writers
- Leaves title (#560), summary (#564), source (#567), trigger_type (#568),
  idempotency_key (#569), trigger_reference (#571), related_entity_type (#572),
  restaurant_memories.*, and operational_issues.* untouched

## Verification

- `npm run typecheck`
- focused `activityEventsRelatedEntityIdCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
