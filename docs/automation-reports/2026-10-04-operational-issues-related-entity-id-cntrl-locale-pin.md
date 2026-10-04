# MISE-005HA: operational_issues.related_entity_id cntrl locale pin

Date: 2026-10-04

## Change

Additive CHECK-only migration attaches `operational_issues_related_entity_id_check` as:

- `related_entity_id is null` OR
- `length(trim(related_entity_id)) between 1 and 240` plus
- `related_entity_id collate "C" !~ '[[:cntrl:]]'`

## Why

Foundation declared nullable text with no CHECK. Writers insert system entity
IDs (`inventory_item_id::text`). The activity_events sibling already bounds to
240 and was tipped as #573. This closes LC_CTYPE dump/restore drift for
operational issue entity-id keys under COLLATE C.

## Alone-OK

Leaves title (#561), explanation (#562), dedupe_key (#456), category / severity /
status allowlists, and related_entity_type (#616) untouched. Alone-OK versus
open #616/#615/#614/#613 and earlier tips.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
