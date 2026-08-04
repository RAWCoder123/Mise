# Staff notification audit + manual insight preserve (2026-08-04)

## Gaps
1. Edge allows staff `update_my_notification_preferences`, but SQL `staff_audit_actions` omitted `operator_notification_preferences_updated`. Staff preference saves could mutate successfully and then fail on audit with a misleading save error.
2. `private.commit_operational_signals` preserved manual purchase recommendations by `generation_source`, yet deleted every insight for the restaurant. Manual manager-authored insights were wiped by routine rules refresh.
3. `receiveSupplierOrder` fetched purchase recommendations twice and used two snapshots for validation vs learning history, creating avoidable demo/hosted drift risk.

## Fixes
- Migration `20260804040000_staff_notification_audit_and_manual_insight_preserve.sql`:
  - Allowlist `operator_notification_preferences_updated` for staff Edge audits.
  - Delete only `mise_rules` / `legacy_client` insights during signal refresh.
- Application: reuse one recommendation snapshot in `receiveSupplierOrder`.
- Contract + pgTAP assertions in `tenant_isolation.test.sql` (plan 451) and unit security pins.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` still unavailable in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.
