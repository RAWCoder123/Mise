# Recommendation generation pilot-readiness gate

Date: 2026-10-08  
Branch: `cursor/mise-recommend-generation-readiness-main-rebase`  
Supersedes stale open #179 (wrong demo canonical each@1 for volume units)

## Problem

Gap audit marked recommendation **generation** UNSAFE: `generatePurchaseRecommendations`,
`regenerateOperationalSignals`, and `addInventoryItemToOrder` could write pending purchase
recommendations without revalidating `buildPilotReadiness` / `canRecommend`. UI gates are not
authorization.

## Fix

- Domain: `assertPilotCanRecommend`, blocked/unavailable errors
- Application: `requirePilotCanRecommend` fail-closed wrapper
- Block `generatePurchaseRecommendations` and `addInventoryItemToOrder` until `canRecommend`
- `regenerateOperationalSignals` still refreshes insights, but publishes an empty recommendation
  set when readiness is blocked or unavailable
- Demo schema v14 seeds physical-count ledger rows and unit-correct canonical verification via
  operationalMapping mass/volume multipliers (same correct seed as #712; not #179’s each@1 catch-all)
- Inventory detail surfaces localized readiness-blocked / unavailable add-to-order copy (EN/ES/zh-Hans)

## Relationship

- Complements application approve gate #712 and server RPC gate #711
- Supersedes stale open #179 — close #179 when this lands
- Does not land Home/Orders readiness UI banners (#177) or signal-commit gate (#199)

## Verification

- `npm run typecheck` — passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited recalculationCycles timer flake)
- `npm run security:static` — passed
- `npm run security:backend` — passed
