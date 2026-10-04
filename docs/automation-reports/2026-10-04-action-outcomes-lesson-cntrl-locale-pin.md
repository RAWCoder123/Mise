# MISE-005HB action_outcomes.lesson cntrl locale pin

Date: 2026-10-04

## Change

Additive CHECK-only migration attaches `action_outcomes_lesson_check` as:

- `lesson is null` OR
- `length(trim(lesson)) between 1 and 1000` plus
- multiline-aware ASCII control rejection under COLLATE `"C"`:
  `lesson collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

Allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` /
operator_note / restaurant_memories.correction / activity_events.summary).
Rejects other C0 controls and DEL.

## Why

Foundation declared nullable text with no CHECK. The activity capture trigger
bounds via `nullif(left(trim(new.lesson), 1000), '')` when copying into
`activity_events.summary` (#564). This closes LC_CTYPE dump/restore drift for
free-form outcome lessons under COLLATE C without blocking legitimate newlines.

## Alone-OK

Leaves idempotency_key (#457), jsonb payload bounds, measure_outcome writers,
and activity_events.summary (#564) untouched. Alone-OK versus open
#617/#616/#615/#614/#613 and earlier tips.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
