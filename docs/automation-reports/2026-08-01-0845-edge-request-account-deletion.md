# Edge-owned account deletion request RPC

## Problem
`public.request_my_account_deletion` remained executable by authenticated clients. A direct RPC call could archive sole-owned restaurants and disable memberships without completing Auth deletion through `request-account-deletion`, leaving operators in a lockout/DoS state outside the intended Edge workflow.

## Fix
- Migration `20260801084500_edge_request_account_deletion.sql` adds actor-bound `service_request_my_account_deletion`.
- Legacy `request_my_account_deletion` keeps an auth.uid() wrapper but authenticated execute is revoked.
- Edge `request-account-deletion` calls the service RPC with the authenticated actor id.
- pgTAP and static security contracts assert the privilege boundary.

## Verification
- Unit/static gates: typecheck, `npm test`, `security:backend`, `security:static`, `design:static`, `qa:routes`.
- Docker pgTAP / hosted staging re-proof still required.
