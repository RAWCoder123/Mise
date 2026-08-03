# Team hub loading + false-empty polish (2026-08-03)

## Gap
`/settings/team` treated load failures and restaurant switches as an empty roster (“No teammates yet”), and every focus/reload blanked the directory with a hard loading path. Pending invites could also claim “no pending invite links” before the restaurant’s invite list settled.

## Change
- `services/presentation/teamHubPresentation.ts` keeps loading/error roster, empty, and pending-invite copy distinct from true empty states.
- Team settings soft-refreshes on focus; full-screen loading only for first paint / restaurant switch.
- `RetryNotice` with `load(true)` on failure; prior roster remains visible after a soft-refresh failure.
- EN / ES / zh-Hans catalog keys for team loading, unavailable, retry, and pending-invite unsettled states.
- Tenant-safety gate updated for Team hub readiness.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-c21c` (FF from `1dc2` tip + Team hub polish)
