# MISE-005FK: activity_events.error_code cntrl locale pin

## Summary

Additive CHECK-only migration attaches `activity_events_error_code_check`
as null OR `length(trim(error_code)) between 1 and 80` plus
`error_code collate "C" !~ '[[:cntrl:]]'`.

The foundation column was nullable text with no CHECK. The `record_activity`
writer already normalizes with `nullif(left(trim(...), 80), '')`; this tip
locks that bound and closes LC_CTYPE dump/restore drift for activity
system failure labels.

## Scope

- CHECK-only; does not rewrite activity RPCs or writers
- Leaves title (#560), summary (#564), source (#567), trigger_type (#568),
  idempotency_key (#569), trigger_reference (#571), related_entity_type (#572),
  related_entity_id (#573), sequence_id (#574), restaurant_memories.*,
  operational_issues.*, and mise_actions.error_code untouched
- Does not expand to `^[a-z0-9_]{1,80}$` charset allowlist (cntrl-only)

## Verification

- `npm run typecheck`
- focused `activityEventsErrorCodeCntrlLocalePin`
- `npm test`
- pgTAP plan derived from assertion call sites (Docker may be unavailable)
