# Approve path revalidates pilot readiness (2026-08-26)

## Summary

Recommendation approval no longer trusts UI-only gates. `approvePurchaseRecommendation` fetches live pilot readiness and fails closed when `canRecommend` is false or readiness cannot be verified. The local demo dataset seeds physical counts and verified canonical units so the demo operating loop remains approvable.

## Changes

- Domain: `PilotReadinessBlockedError`, `PilotReadinessUnavailableError`, `assertPilotCanRecommend`
- Application: readiness revalidation before `approve_purchase_recommendation` RPC
- Home / Orders: localized readiness-blocked and readiness-unavailable approve errors (EN/ES/zh-Hans)
- Demo v14: per-item physical-count ledger rows + verified canonical units for countable units
- Tests: domain assert, demo canRecommend pin, application/UI source pins, schema 14 repair

## Verification

- `npm run typecheck`
- `npm test` — 637 pass / 0 fail (7 pre-existing recalculation timeout cancellations)

## Still open

- Server-side readiness revalidation inside `approve_purchase_recommendation` SQL/RPC (Codex/migration)
- UI pilot readiness banners on Home/Orders (#177) and soft-refresh fail-closed (#176)
