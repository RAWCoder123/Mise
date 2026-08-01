# Edge-route team membership workflows (2026-08-01)

## Problem

Owners/admins could still mutate restaurant memberships and invites through authenticated Data API RPCs (`add_restaurant_member`, `add_restaurant_member_by_email`, `update_restaurant_member`, `remove_restaurant_member`, `create_restaurant_member_invite`, `revoke_restaurant_member_invite`), bypassing `operational-workflows` Edge reservation, rate limiting, and Edge audit logging.

## Change

- Migration `20260801012000_edge_team_membership_workflows.sql`:
  - Adds service-owned team/invite mutation RPCs (`service_role` only).
  - Revokes authenticated execute on the legacy public mutation RPCs.
  - Keeps `claim_restaurant_member_invite` as an authenticated token RPC because invitees are not yet restaurant members and cannot reserve Edge workflows.
- Edge `operational-workflows` adds owner/admin-only team actions with audit metadata that never stores claim tokens.
- Hosted repository team mutations invoke Edge; local demo paths unchanged.
- pgTAP team/invite/tenant suites assert privilege revokes and service-RPC authority.
- Static security contract covers Edge actions, service grants, and claim exception.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run design:static`, `npm run qa:routes` in this cycle when the environment allows.
- Docker/hosted `verify:private-beta-security` remains blocked here without Docker/staging credentials.
