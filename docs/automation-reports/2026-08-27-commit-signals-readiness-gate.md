# Commit operational signals pilot readiness gate (2026-08-27)

## Closed
- `private.commit_operational_signals` empties pending system recommendations when
  `evaluate_pilot_can_recommend` reports `canRecommend=false`
- Insights still replace; stale `mise_rules` / `legacy_client` pending rows clear
- Purchase approve/create wrappers authorize membership before readiness evaluation
  (closes cross-tenant readiness-detail disclosure from #181)

## Why
Open gates (#177–#181) close app and purchase RPC write paths, but POS sync /
count / recipe mutations still commit Edge-generated recommendations through
`service_commit_operational_signals` without a server-side canRecommend check.

## Paths
- `supabase/migrations/20260827050000_commit_operational_signals_readiness_gate.sql`
- `supabase/tests/database/commit_operational_signals_readiness_gate.test.sql`
- `tests/commitOperationalSignalsReadinessGate.test.ts`
- Report: `docs/automation-reports/2026-08-27-commit-signals-readiness-gate.md`

## Stacking
- Branched from `cursor/mise-product-inspection-4804` (#181)
- Depends on `private.evaluate_pilot_can_recommend`

## Do not redo
- Application generation gate (#179)
- Approve / create_pending RPC gates (#181)
- Durable order lines / receive / send fingerprint (#196–#198)

## Verification
- Static pins in `tests/commitOperationalSignalsReadinessGate.test.ts`
- pgTAP source proof (Docker not available in this cloud run)
- `npm run typecheck`
- `npm test`
- `npm run security:backend`
