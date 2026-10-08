# Commit operational signals pilot readiness gate (2026-10-08)

## Closed
- `private.commit_operational_signals` empties pending system recommendations when
  `evaluate_pilot_can_recommend` reports `canRecommend=false`
- Insights still replace; stale `mise_rules` / `legacy_client` pending rows clear
- Alone-OK on `origin/main`: ships `evaluate_pilot_can_recommend` with the same
  POS / count / recipe contract as the purchase RPC readiness tip

## Why
App generation (#713), application approve (#712), purchase RPC (#711), and
Home/Orders UI (#714) gates are not enough on their own: POS sync / count /
recipe mutations can still persist Edge-generated recommendations through
`service_commit_operational_signals` without a server-side readiness check.

## Paths
- `supabase/migrations/20261008130000_commit_operational_signals_readiness_gate.sql`
- `supabase/tests/database/commit_operational_signals_readiness_gate.test.sql`
- `tests/commitOperationalSignalsReadinessGate.test.ts`

## Stacking
- Fresh tip from `origin/main` (`78da7376`)
- Supersedes stale open #199 (branched from inspection/#181)
- Does not wrap approve/create purchase RPCs — that remains #711

## Do not redo
- Application generation gate (#713)
- Application approve gate (#712)
- Purchase RPC readiness gate (#711)
- Home/Orders UI gate (#714)

## Verification
- Static pins in `tests/commitOperationalSignalsReadinessGate.test.ts`
- pgTAP source proof (Docker may be unavailable in cloud runs)
- `npm run typecheck`
- `npm test`
- `npm run security:static`
