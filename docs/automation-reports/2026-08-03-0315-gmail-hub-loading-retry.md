# Gmail settings loading + false-disconnected polish (2026-08-03)

## Gap
`/settings/gmail` could claim “Not connected” while status was still loading or after a failed refresh, and load failures only showed a non-actionable notice without RetryNotice soft-refresh parity used by POS/Recipes/Team.

## Change
- `services/presentation/gmailHubPresentation.ts` keeps loading/error status and sender copy distinct from true disconnected.
- Gmail settings soft-refreshes on focus; full-screen loading only for first paint / restaurant switch.
- `RetryNotice` with `load(true)` on failure; connect/disconnect actions stay hidden until hub readiness.
- EN / ES / zh-Hans catalog keys for Gmail retry and unsettled sender copy.
- Tenant-safety gate updated for Gmail hub readiness.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-c21c` (Team hub polish + Gmail hub polish)
