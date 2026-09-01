# Home pulse fails closed on unknown/stale freshness

Date: 2026-09-01  
Branch: `cursor/mise-product-inspection-238e`  
Base: `origin/main` @ `20b28e5`

## Problem

`buildOperatingBrief` could classify restaurant pulse as `on_track` when data freshness was `unknown`. Home hides the status banner for `on_track`, so operators saw an all-clear even when Mise could not determine whether sales/inventory evidence was current. Stale freshness already mapped to `attention_needed`, but healthy-coverage + stale was under-tested and did not surface freshness in `topRisk` / summary when no approvals or menu risks existed.

## Change

- Export `resolveRestaurantPulseStatus` and treat `unknown` (and existing `stale`) as `attention_needed`.
- Keep `incomplete` as `at_risk`.
- Prefer freshness labels for `topRisk` and attention summaries when freshness blocks an all-clear pulse.

## Paths

- `services/domain/operatingBrief.ts`
- `tests/operatingBrief.test.ts`
- `docs/automation-reports/2026-09-01-home-pulse-unknown-freshness.md`

## Verification

- `npm run typecheck`
- focused `tests/operatingBrief.test.ts`
- `npm test` (domain suite)

## Notes

- No migration, no package-lock change, no contested Codex paths.
- Does not invent inventory or sales facts; only refuses a false all-clear when freshness is not trustworthy.
