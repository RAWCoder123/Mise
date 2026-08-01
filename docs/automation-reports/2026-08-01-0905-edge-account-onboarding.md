# Edge-route pre-membership account onboarding (2026-08-01)

## Problem

Authenticated Expo clients could call `create_restaurant_with_owner` and
`claim_restaurant_member_invite` directly. Those are pre-membership mutations, so
they could not use restaurant-scoped `operational-workflows` reservation, and
they bypassed Edge rate-limit / security-event ownership.

## Change

- Migration `20260801090525_edge_account_onboarding_workflows.sql`:
  - Adds user-scoped `reserve_user_scoped_edge_function_invocation` /
    `record_user_scoped_edge_function_security_event` for `account-onboarding`.
  - Adds service-owned `service_create_restaurant_with_owner` and
    `service_claim_restaurant_member_invite` (`service_role` only).
  - Revokes authenticated execute on the legacy public create/claim RPCs.
  - Preserves the five-workspace lifetime quota and invite email/token checks.
- New Edge Function `account-onboarding` with actions:
  - `create_restaurant_with_owner`
  - `claim_restaurant_member_invite`
- Hosted repository routes create/claim through that Edge Function; demo paths stay local.
- Security static/backend contracts and pgTAP invite/quota tests updated.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run security:static`,
  `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
