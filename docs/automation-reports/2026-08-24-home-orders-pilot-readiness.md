# Home + Orders pilot readiness UI gate

Date: 2026-08-24  
Branch: `cursor/mise-product-inspection-orders-readiness`  
Baseline: `origin/main` @ `706590de293290d1dcfaf5bef82f27bd85c18fc5` (post MISE-004A)

## Closed

1. Shared fail-closed `pilotRecommendUiGate` for Home and Orders.
2. Home loads `fetchPilotReadiness` with the brief/summary and blocks one-tap recommend when `canRecommend` is false or readiness is unavailable.
3. Orders loads the same readiness contract, banners material blockers, and routes Review-setup approve taps to `/settings/pos` instead of approving.
4. EN / ES / zh-Hans catalog coverage for Home and Orders readiness copy.
5. Orders soft reload (`load(false)`) clears `pilotReadiness` immediately so approve cannot race on a stale `canRecommend` window while hub rows stay visible.

## Pins

- `tests/pilotRecommendUiGate.test.ts`
- `tests/pilotUiSafety.test.ts` Home + Orders readiness pins + soft-reload invalidation pin

## Do not redo

- Failing open when readiness load errors.
- Approving recommendations while `canRecommend` is false from Home or Orders.
- Leaving prior readiness actionable during Orders soft refresh.
- Editing domain `pilotReadiness.ts` for this UI gate.
- Auto-sending supplier email from Home or Orders.

## Supersedes

Draft PR #144 / #136 Home-only readiness work — this branch rebases the Home gate onto post–MISE-004A main and adds Orders parity.
