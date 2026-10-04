# MISE-005HE operational_finding_decisions.edited_recommended_action cntrl locale pin

Date: 2026-10-04

## Change

Additive CHECK-only migration attaches
`operational_finding_decisions_edited_recommended_action_check` as:

- `edited_recommended_action is null` OR
- `length(trim(edited_recommended_action)) between 1 and 320` plus
- ASCII control rejection under COLLATE `"C"`:
  `edited_recommended_action collate "C" !~ '[[:cntrl:]]'`

Column is nullable (approved/dismissed stay null). Single-line edited
recommended-action snapshot when present; rejects LF/TAB/CR/NUL/DEL.

## Why

Append migration left edited action without a dedicated column CHECK; only
`operational_finding_decision_edit_check` required length(trim) 1..320 when
`decision_type = 'edited'`. Writers trim to 320 in SQL and TypeScript. Closing
LC_CTYPE dump/restore drift under COLLATE C keeps finding-decision evidence
bytes stable across restore without rewriting the edit-shape CHECK or
`original_recommended_action` (#620).

## Alone-OK

Leaves `operational_finding_decision_edit_check` semantics,
`original_recommended_action` (#620), `finding_id`, `decision_type` (#537),
`policy_version`, category/severity allowlists, evidence bounds,
`client_event_id`, and `idempotency_key` untouched. Alone-OK versus open
#620/#619/#618/#617/#616/#615 and earlier tips.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
