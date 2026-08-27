# MISE-004B bounded purchase-decision advisory quantity

## Boundary

MISE-004B uses established MISE-004A purchase-decision patterns as a bounded
advisory input to recommendation *quantity* only. It does not change purchase
authority, supplier-send authority, autonomy, Orders quantity inputs, or
dismissal suppression.

## Policy

Pattern version remains `mise.purchase_pattern.v1`.

A pattern may influence quantity only when all of the following are true:

- `eligible` (at least five active comparable decisions)
- `evidenceStrength === "established"` (≥80% agreement)
- `currentContext` (supplier and verified canonical unit still match)
- `medianQuantityRatio` is finite and inside `[0.5, 1.75]`
- `dominantOutcome` is `exact`, `upward`, or `downward`

Dismissal-dominant, emerging, mixed, and insufficient patterns never change a
quantity and never suppress a recommendation in this milestone.

Applied quantity:

```text
ceil(calculatedQuantity × medianQuantityRatio)
```

then rejected unless it stays inside the existing absolute learning bounds
(`max(1, calculated×0.5)` … `max(calculated×1.75, par×1.25, 1)`). When an
established pattern applies, it takes precedence over the coarse absolute
approved-quantity median. Recommendation reason text discloses the pattern
ratio and sample count.

## Surfaces

- Hosted: `private.fetch_operational_planning_snapshot` includes
  `purchaseDecisionPatterns`; `calculateOperationalSignals` applies the advisory.
- Demo: `rebuildPurchaseRecommendations` builds patterns from local decision
  events and applies the same helper.
- Orders UI still shows factual pattern summaries and does not rewrite the
  operator quantity input from patterns.

## Explicit exclusions

- No auto-approve, auto-send, or auto-dismiss
- No inventing inventory, sales, or cost facts
- No embeddings, vectors, or LLM memory
- No rewrite of historical decision events
