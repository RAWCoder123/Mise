# MISE-005HY outreach_agent_runs.error_summary cntrl locale pin

Date: 2026-10-05

## Change

Additive CHECK-only migration attaches `outreach_agent_runs_error_summary_check` as:

- `error_summary is null` OR
- `length(trim(error_summary)) between 1 and 1000` plus
- multiline-aware ASCII control rejection under COLLATE `"C"`:
  `error_summary collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'`

Allows LF/TAB/CR (same class as `unsafeSupplierSendMultilineControlPattern` /
operator_note / action_outcomes.lesson / activity_events.summary).
Rejects other C0 controls and DEL.

## Why

Foundation declared nullable text with no CHECK. Writers already bound:

- joined partial errors via `slice(0, 1000)`
- failed-run path via `safeError` (`slice(0, 500)`)

This closes LC_CTYPE dump/restore drift for free-form run summaries under
COLLATE C without blocking legitimate newlines in joined error fragments.

## Alone-OK

Leaves trigger_type/status (#528), counter CHECKs, outreach-agent writers, and
sibling outreach_messages tips (#640/#639/#638–#635) untouched.

## Verification

- Focused static contract tests
- `npm run typecheck`
- `npm test` baseline (no new failures)
- pgTAP plan counted from assertion call sites (Docker may be unavailable)
