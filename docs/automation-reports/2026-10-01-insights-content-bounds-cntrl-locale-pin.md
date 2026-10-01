# MISE-005EL insights_content_bounds cntrl locale pin

Date: 2026-10-01

## Change

CHECK-only replace of `insights_content_bounds_check` preserving exact length
bounds:

- `title` — `length(trim(title)) between 1 and 240`
- `description` — `length(trim(description)) between 1 and 4000`
- `recommended_action` — `length(trim(recommended_action)) between 1 and 2000`
- `why_it_matters` — null or `length(why_it_matters) <= 2000`

plus ASCII control rejection under `COLLATE "C"` on each non-null field.

## Why

The original bounds CHECK had no control-character gate. Insight body text is
durable operator-facing content. Sibling MISE-005 tips pin text CHECKs under
`COLLATE "C"` so dump/restore cannot accept bytes a restored C-locale path
would refuse.

## Out of scope

- Insight commit writer / RPC rewrites
- `insights.insight_type` / `severity` (#515)
- `insights.generation_source` (#485)
- `ai_insights` provenance (#483)
- `supplier_orders.operator_note` (multiline-aware tip remains separate)

## Verification

- `npm run typecheck`
- focused `insightsContentBoundsCntrlLocalePin` tests
- `npm test`
- pgTAP plan **17** counted from 17 assertion call sites
