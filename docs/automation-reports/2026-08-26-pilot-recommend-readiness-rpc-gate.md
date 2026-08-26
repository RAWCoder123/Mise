# Server-side pilot canRecommend RPC gate (2026-08-26)

## Closed
- `private.evaluate_pilot_can_recommend` mirrors TS recommendation areas (POS, counts, recipe coverage)
- `approve_purchase_recommendation` requires canRecommend while status is `pending`
- `create_pending_purchase_recommendation` requires canRecommend before insert
- Approved replay (`already_applied`) skips the readiness re-check
- Hosted repository maps readiness RPC failures to `PilotReadinessBlockedError`
- Domain helpers: `assertPilotCanRecommend`, typed blocked/unavailable errors, RPC message detector

## Paths
- `supabase/migrations/20260826100000_pilot_recommend_readiness_rpc_gate.sql`
- `supabase/tests/database/pilot_recommend_readiness_rpc_gate.test.sql`
- `supabase/tests/database/purchase_approval_authority.test.sql`
- `supabase/tests/database/purchase_decision_memory.test.sql`
- `services/domain/pilotReadiness.ts`
- `services/application/pilotReadiness.ts`
- `services/repositories/supabaseRepository.ts`
- `tests/pilotRecommendReadinessRpcGate.test.ts`
- Report: `docs/automation-reports/2026-08-26-pilot-recommend-readiness-rpc-gate.md`

## Do not redo
- Application-layer approve/generation gates (#178/#179)
- Home/Orders readiness UI (#177)
- Demo seed v14 count/canonical repair (#178/#179) — demo path remains client-authority until those land

## Still open
- Hosted Docker pgTAP execution for this migration
- Sync→planning correlation after #130/#132
