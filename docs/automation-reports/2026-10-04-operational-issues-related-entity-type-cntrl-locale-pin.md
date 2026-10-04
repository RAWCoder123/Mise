# MISE-005GZ: operational_issues.related_entity_type cntrl locale pin

Date: 2026-10-04

## Change

Additive CHECK-only migration attaches `operational_issues_related_entity_type_check` as:

- `related_entity_type is null` OR
- `length(trim(related_entity_type)) between 1 and 80` plus
- `related_entity_type collate "C" !~ '[[:cntrl:]]'`

## Why

Foundation declared nullable text with no CHECK. Writers insert short system
entity-type labels (`inventory_item`). The activity_events sibling already
bounds to 80 and was tipped as #572. This closes LC_CTYPE dump/restore drift
for operational issue entity-type keys under COLLATE C.

## Alone-OK

Leaves title (#561), explanation (#562), dedupe_key (#456), category / severity /
status allowlists, and related_entity_id untouched. Alone-OK versus open
#615/#614/#613 and earlier tips.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
