# Home / Orders pilot readiness UI — main rebase

Date: 2026-10-08  
Branch: `cursor/mise-home-orders-pilot-readiness-main-rebase`  
Baseline: `origin/main` @ `78da7376`  
Supersedes: open draft #177 (`cursor/mise-home-orders-pilot-readiness`, based on `20b28e50`)

## Problem

Application and server readiness gates for recommendation approve/generation are tipped separately (#711–#713). On `main`, Home and Orders still expose one-tap approve without loading `fetchPilotReadiness`, so operators get opaque failures (or succeed against incomplete setup) instead of a clear setup path.

## Change

Rebases the fail-closed Home/Orders pilot-readiness UI gate onto current `origin/main`:

- Shared `pilotRecommendUiGate` presentation helper
- Home and Orders load `fetchPilotReadiness`, show material setup/send banners, and route Review setup to `/settings/pos`
- Orders soft reload clears readiness immediately so approve cannot race on a stale `canRecommend` window
- EN/ES/zh-Hans copy plus pins in `tests/pilotRecommendUiGate.test.ts` and `tests/pilotUiSafety.test.ts`

## Boundaries

- No migration or RPC changes
- Does not duplicate #711 server RPC, #712 application approve, or #713 generation gates
- Alone-OK beside those tips; close #177 when this lands

## Verification

- `npm run typecheck`
- focused: `pilotRecommendUiGate`, `pilotUiSafety`
- `npm run security:static` (when run)
- `npm test` (when run)
