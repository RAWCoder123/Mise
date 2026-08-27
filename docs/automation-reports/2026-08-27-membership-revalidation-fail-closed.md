# Membership revalidation fail-closed (2026-08-27)

## Context

Stacked on `cursor/mise-session-hydrate-allsettled` (PR #170). Greptile flagged that live
revalidation can fetch newer membership authorization and then leave prior restaurant/role
UI active when restaurant hydration throws before memberships are committed.

On `origin/main`, tenant-authorization denial listeners already revalidate memberships, but
errors only call `captureMiseError`, so stale workspace UI can survive a denial.

## Changes

- `clearUnverifiedWorkspaceAccess` shared clear path for revoked active workspace
- Denial-triggered revalidation uses `failClosedOnError: true`
- Denial errors clear restaurant/role/POS/membership UI and persisted active restaurant while
  keeping the Auth user signed in
- Queue a follow-up denial revalidation when a denial arrives mid-refresh
- Periodic / AppState / Realtime revalidation remain soft-fail for transient network errors
- Commit `setMemberships(nextMemberships)` (and role when still active) before restaurant
  hydration in both live revalidation and `hydrateSupabaseUser`, so a later preferred-workspace
  failure cannot preserve a revoked membership or elevated role

## Verification

- `npm run typecheck`
- Targeted tenant-safety + session hydration tests
- `npm test`

## Out of scope

- Does not replace or rewrite PR #170 selective hydration
- Does not add setup StatusNotice copy from the historical 1fc0 follow-up
- Does not change hosted membership RPC purity
