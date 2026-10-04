# MISE-005HD operational_finding_decisions.original_recommended_action cntrl locale pin

Date: 2026-10-04

## Change

Additive CHECK-only migration reattaches
`operational_finding_decisions_original_recommended_action_check` as:

- `length(trim(original_recommended_action)) between 1 and 320` plus
- ASCII control rejection under COLLATE `"C"`:
  `original_recommended_action collate "C" !~ '[[:cntrl:]]'`

Column is NOT NULL (no null OR branch). Single-line recommended-action
snapshot; rejects LF/TAB/CR/NUL/DEL.

## Why

Append migration declared length(trim) 1..320 only. Writers trim to 320 in SQL
and TypeScript. Closing LC_CTYPE dump/restore drift under COLLATE C keeps
finding-decision evidence bytes stable across restore without rewriting the
edit-shape CHECK or `edited_recommended_action`.

## Alone-OK

Leaves `operational_finding_decision_edit_check` semantics,
`edited_recommended_action`, `finding_id`, `decision_type` (#537),
`policy_version`, category/severity allowlists, evidence bounds,
`client_event_id`, and `idempotency_key` untouched. Alone-OK versus open
#619/#618/#617/#616/#615 and earlier tips.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
