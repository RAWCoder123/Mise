# Purchase-loop count-variance advisory learning

Date: 2026-08-27  
Branch: `cursor/mise-purchase-loop-count-learning`  
Base: `origin/cursor/mise-purchase-loop-count-variance` (PR #194)

## Problem

Purchase-loop receive and count outcomes were measured (`mise.purchase_loop_outcome.v1`) but never fed back into recommendation quantities. Operators with chronic post-receive undercounts kept seeing unpadded reorder suggestions.

## Change

1. Domain `purchaseLoopLearning` extracts count-phase samples, requires ≥3 recent short samples, winsorizes ratios, and applies a bounded multiplier (≤1.25) after approval-median learning with the same absolute bounds.
2. `calculateOperationalSignals` pads low-stock quantities and emits `insight.rule.ordering.chronic_count_short` (EN/ES/ZH presentation).
3. Demo rebuild + PlanningData (`purchaseLoopCountHistory`) carry the same evidence; hosted client reads bounded `action_outcomes`.
4. Additive migration exposes `private.purchase_loop_count_history_json` on the operational planning snapshot for Edge refresh.

## Non-goals

- Does not change purchase authority, approve/dismiss/send RPCs, or invent inventory quantities.
- Does not suppress recommendations or feed dismiss-dominant patterns.
- Does not duplicate open short-ship (#201) or 004B (#200) multiplier stacks; compose later when those land.
- Does not require hosted Docker pgTAP in this run.

## Verification

- `npm run typecheck`
- Targeted learning + signals + migration static tests
- Broader `npm test` / `npm run security:backend`
