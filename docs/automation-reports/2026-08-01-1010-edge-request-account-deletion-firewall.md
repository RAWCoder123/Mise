# User-scoped Edge firewall for account deletion (2026-08-01)

## Problem

`request-account-deletion` archived restaurants, disabled memberships, and deleted
Auth users without the user-scoped reservation / rate-limit / security-event path
that `account-onboarding` already used. Status transitions to `processing` /
`completed` also ignored PostgREST update errors.

## Change

- Migration `20260801101000_edge_request_account_deletion_firewall.sql`:
  - Allowlists `request-account-deletion` on `edge_function_security_events`.
  - Adds policy `4` attempts / `300` seconds (roles unused; actor-id scoped).
  - Extends `reserve_user_scoped_edge_function_invocation` and
    `record_user_scoped_edge_function_security_event` to both user-scoped functions.
- Edge `request-account-deletion` reserves before mutation, finalizes completed/error
  events, and fails closed when request status updates do not apply.
- Shared `UserScopedEdgeFunctionName` includes `request-account-deletion`.
- Security static/backend contracts and pgTAP account-deletion tests require the firewall.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run security:static`,
  `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
