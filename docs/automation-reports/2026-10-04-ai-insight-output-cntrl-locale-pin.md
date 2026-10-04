# MISE-005HJ: ai_insights structured output cntrl locale pin

## Summary

Additive migration rewrites `private.structured_ai_insight_output_is_valid` so:

- `title`, `summary`, `recommended_action`, and evidence strings reject ASCII
  controls under `COLLATE "C"` while keeping existing length bounds;
- `risk_level` / `affected_workflow` allowlists compare under `COLLATE "C"`.

The foundation validator used length-only text gates and bare IN allowlists.
`ai_insights.output` is durable structured insight evidence; locale drift under
those bare gates can make dump/restore accept (or refuse) output bytes that
disagree with a restored C-locale path.

Structured insight fields are single-line machine tokens (not
operator-note-style multiline prose).

## Scope

- Validator-only; does not rewrite `service_create_rules_engine_ai_insight`
- Leaves `schema_version` (#479 / MISE-005BS), provenance
  (#483 / MISE-005BW), and `insights_content_bounds` (#550 / MISE-005EL)
  untouched
- Alone-OK versus open #479 / #483 / #550 / #625

## Verification

- `npm run typecheck` passed
- focused `aiInsightOutputCntrlLocalePin` 4/4 passed
- `npm test` 680 pass / 0 fail / 7 cancelled (pre-existing
  `recalculationCycles` withTimeout hang)
- pgTAP plan 16 from 16 assertion call sites (Docker/pgTAP unavailable
  in this environment)
