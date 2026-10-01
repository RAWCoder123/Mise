# Stockout reason categories (2026-09-03)

Tip: `cursor/mise-stockout-reason-categories`

## Problem

Operator stockout events zero on-hand without structured cause. Waste (#301) and
usage (#365) already capture allowlisted reason codes; stockouts remained free-form
optional notes only, so purchasing and coverage learning could not compare why
coverage reached zero.

## Change

- Domain allowlist: `under_ordered`, `unexpected_demand`, `delivery_missed`,
  `spoilage_cleared`, `theft_loss`, `other`
- `requireInventoryOperation` requires an allowlisted stockout `reasonCode`
- Inventory detail stockout flow: reason picker + EN/ES/zh-Hans copy
- High-attention codes reserved for future brief/analysis surfaces (no Home churn)

## Verification

- Domain + validation + UI static pins
- `npm run typecheck`
- `npm test` (targeted + full suite)
- `npm run security:static`
- `npm run design:static`

## Contested

`app/inventory/[id].tsx` is shared with open stacks (#231/#301/#348/…). Expect rebase.
