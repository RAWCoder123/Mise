# Automation report — Membership revalidation fail-closed

Date: 2026-08-04 ~09:15 UTC  
Branch: `cursor/mise-product-inspection-1fc0`

## Gap

After repository tenant-authorization denials (401/403/RLS), `MiseSessionContext` revalidated memberships but swallowed fetch failures and left stale restaurant/role/POS UI active. Server RLS still blocked data, but the client could continue displaying a revoked workspace until a later successful check.

## Fix

1. Extract `clearUnverifiedWorkspaceAccess` for the existing revoked-membership clear path.
2. Denial-triggered revalidation uses `failClosedOnError: true`.
3. If live membership fetch fails after a denial, clear restaurant/memberships/role/POS and persisted active restaurant while keeping the Auth user signed in.
4. Queue a follow-up denial revalidation when a denial arrives during an in-flight refresh.
5. Periodic/foreground revalidation remains soft-fail so brief network blips do not eject the workspace.

## Tests

- Extended `tests/clientTenantSafety.test.ts` contract pins for fail-closed denial revalidation.

## Remaining

- Docker/hosted security re-proof still required.
- Optional UX: dedicated “workspace access could not be verified” StatusNotice instead of setup redirect.
- Repository read paths that still use raw `throw error` instead of `throwRepositoryError` remain a runner-up.

## Classification

Still controlled pilot-ready pending Docker/hosted gates; not App Store submission-ready.
