# Application-layer pilot approve readiness gate

Date: 2026-10-08  
Branch: `cursor/mise-approve-pilot-readiness-main-rebase`  
Baseline: `origin/main` @ `78da7376`

## Problem

Recommendation approval could reach the repository/RPC without revalidating
`buildPilotReadiness` / `canRecommend`. UI-only gates are not authorization.
Stale open #178 covered the application layer but sat behind MISE-004C and
incorrectly certified unknown purchase units as each@1.

## Change

- Domain: `assertPilotCanRecommend` plus blocked/unavailable errors
- Application: fetch readiness and fail closed before `approvePurchaseRecommendation`
- Home/Orders: localized readiness-blocked and unavailable approve errors (EN/ES/zh-Hans)
- Demo schema v14: seed physical-count ledger rows and verified canonical units
  using operationalMapping mass/volume multipliers; discrete heads/packs/units
  verify as each@1 only when they are the counted purchase unit; unknown units
  stay unverified
- Tests: `tests/pilotApproveReadinessGate.test.ts`

## Relationship to other PRs

- Complements server RPC gate #711 (does not replace it)
- Supersedes stale open #178 as a current-main rebase
- Does not land Home/Orders readiness UI banners (#177) or generation gate (#179)

## Verification

- `npm run typecheck`
- Focused `tests/pilotApproveReadinessGate.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when environment allows
