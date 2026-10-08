# MISE-005KV: pin hosted requireHostedUuid identity to ASCII C

Date: 2026-10-08

## Problem

`requireHostedUuid` in `services/repositories/supabaseRepository.ts` used
Unicode-aware `trim()` followed by `toLowerCase()` before accepting restaurant,
supplier, and inventory identities from the hosted Data API. Unicode trim
strips NBSP / em-space padding and invents a canonical UUID that the unpadded
value would have produced. That corrupts fail-closed identity checks on the
hosted repository boundary.

## Change

- Add `services/domain/hostedUuidIdentity.ts` with ASCII-only end trim and
  ASCII A–Z case fold (MISE-005KV).
- Route `requireHostedUuid` through `requireCanonicalHostedUuid`, preserving
  the existing `Invalid ${label} identity.` error contract.
- Leave Edge/outreach `uuidIdentity.ts` tips (#719 / #720) and
  `miseValidation.requireSupplierAuthorityId` untouched.

## Verification

- Focused `tests/hostedUuidAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
