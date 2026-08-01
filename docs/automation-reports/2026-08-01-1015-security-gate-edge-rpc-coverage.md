# Security gate coverage for Edge-owned RPCs (2026-08-01)

## Problem

After the Edge ownership wave, `security-backend` skipped revoked DEFINER mutators
(`executeRoles.size === 0`) and did not inventory-check public `service_*` wrappers
that are `SECURITY INVOKER`. Hosted `staging-service-rpc-check` also lagged the new
Edge-owned RPCs, so forged actor/tenant probes would not run when staging returns.

## Change

- `scripts/security-backend.mjs`:
  - `revokedAuthenticatedMutators` denylist asserts Edge-replaced mutators stay
    unexecutable by authenticated/anon/public.
  - `edgeOwnedServicePublicFunctions` asserts service wrappers remain service_role-only
    and actor-bound.
- `scripts/staging-service-rpc-check.mjs` adds forged-binding probes for setup,
  purchasing, storage, team, supplier recipients, profile, transfer, onboarding,
  account deletion, and locale service RPCs.
- Unit coverage in `tests/security.test.ts` locks the denylist/probe contracts.

## Verification

- `npm run typecheck`, `npm test`, `npm run security:backend`, `npm run security:static`
  in this cycle when the environment allows.
- Live hosted forgery run still requires staging credentials.
