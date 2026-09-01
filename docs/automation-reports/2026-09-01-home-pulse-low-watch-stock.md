# Home pulse Low/Watch stock fail-closed (2026-09-01)

Tip: `cursor/mise-home-pulse-low-watch-stock`
Base: `origin/main` @ `20b28e5`

## Problem

Home hid the restaurant status banner whenever `restaurantStatus.status === "on_track"`.
Pulse elevation only considered Critical/qty≤0, urgent findings, incomplete freshness,
pending approvals, and stale counts. Fresh Low or Watch coverage risks left the pulse
`on_track`, so operators could see an all-clear while `outlook.menuRisks` already named
the item. Prep readiness also reported `ready` under the same Low/Watch evidence.

Separately, the Home/Inventory health chip used well-stocked percentage alone after
Critical checks, so one Low or Watch item among many Good items could still chip
"Healthy".

## Fix

- Export `resolveRestaurantPulseStatus` and elevate `menuRiskCount > 0` to
  `attention_needed` (Critical/qty≤0 remains `at_risk`).
- Treat any non-Healthy/Learning menu risk as prep `gaps`.
- Clarify attention summaries when only inventory watch items are open.
- Fail closed `inventoryHealthTier` when `low > 0` (attention) or `watch > 0` (watch).

## Paths

- `services/domain/operatingBrief.ts`
- `services/presentation/inventoryHealthPresentation.ts`
- `tests/operatingBrief.test.ts`
- `tests/inventoryHealthPresentation.test.ts`

## Notes

- Complements open #327 (unknown/stale freshness pulse). This tip does not change
  `unknown` freshness handling; merge should keep both gates.
- Does not invent quantities or change purchase authority.
- No migration; no package-lock.

## Verification

- `npm run typecheck` — passed
- focused `tests/operatingBrief.test.ts` and `tests/inventoryHealthPresentation.test.ts` — 12/12 passed
- `npm test` — 636 pass / 0 fail / 7 cancelled (pre-existing `recalculationCycles` hang)
