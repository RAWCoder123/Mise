# Server-side pilot canRecommend RPC gate (2026-10-08 main rebase)

Rebases open #181 onto current `origin/main` after MISE-004C / MISE-005A.

## Closed
- `private.evaluate_pilot_can_recommend` mirrors TS recommendation areas (POS, counts, recipe coverage)
- `approve_purchase_recommendation` requires canRecommend while status is `pending`
- `create_pending_purchase_recommendation` requires canRecommend before insert
- Approved replay (`already_applied`) skips the readiness re-check
- Hosted repository maps readiness RPC failures to `PilotReadinessBlockedError`
- Domain helpers: `assertPilotCanRecommend`, typed blocked/unavailable errors, RPC message detector
- Migration timestamp is after MISE-004C so already-deployed chains still apply the gate
- Pilot match-text identity folds with `lower(... collate "C")`

## Paths
- `supabase/migrations/20261008120000_pilot_recommend_readiness_rpc_gate.sql`
- `supabase/tests/database/pilot_recommend_readiness_rpc_gate.test.sql`
- `supabase/tests/database/purchase_approval_authority.test.sql`
- `supabase/tests/database/purchase_decision_memory.test.sql`
- `services/domain/pilotReadiness.ts`
- `services/application/pilotReadiness.ts`
- `services/repositories/supabaseRepository.ts`
- `tests/pilotRecommendReadinessRpcGate.test.ts`
- Report: `docs/automation-reports/2026-10-08-pilot-recommend-readiness-rpc_gate.md`

## Do not redo
- Application-layer approve/generation gates (#178/#179) — still valuable client UX, but server gate is the authorization boundary
- Home/Orders readiness UI (#177)
- Demo seed v14 count/canonical repair (#178/#179) — demo path remains client-authority until those land
- Do not re-open #181 after this rebase lands; close #181 as superseded

## Still open
- Hosted Docker pgTAP execution for this migration
- Application-layer `assertPilotCanRecommend` before approve RPC (#178)
- Fail-closed recommendation generation (#179) and signal commits (#199)
- Sync→planning correlation after #130/#132
