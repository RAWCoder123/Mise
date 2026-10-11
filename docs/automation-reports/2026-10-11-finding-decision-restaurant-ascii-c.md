# MISE-005NI finding-decision restaurant workspace ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `normalizeOperationalFindingDecisionInput` normalized `restaurantId`
with Unicode `String.prototype.trim()` via `requireBoundedText`. NBSP
(`U+00A0`) or em-space (`U+2003`) padding around a valid restaurant workspace
token would still normalize to that token, inventing an exact tenant match
against unpadded `finding.restaurantId` before scope validation and RPC
argument construction.

Open tip #790 pinned finding-decision object identities (`clientEventId` /
`idempotencyKey`) and intentionally left restaurant workspace
`requireBoundedText` alone for a later tip. Application tip #749 pinned the
read-path restaurant workspace in `services/application/findingDecisions.ts`
without changing this domain write-path normalize.

## Change

- Added `services/domain/operationalFindingDecisionRestaurantIdentity.ts`
  with ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `normalizeOperationalFindingDecisionInput` through
  `requireCanonicalOperationalFindingDecisionRestaurantId`.
- Preserved require message `Restaurant workspace is invalid.` and the
  existing 64-character bound.
- Left `clientEventId` / `idempotencyKey` on Unicode `requireBoundedText`
  for open tip #790, and left `finding.id.trim()`, evidence identities, and
  free-text recommended actions untouched.
- Left application finding-decisions restaurant tip (#749) on its own module.
- UUID-shaped and non-UUID demo tokens intentionally preserved.

## Merge note

Alone-OK relative to open stacks through #790 and #192. Does not share identity
modules with finding-decision object identities (#790), application
finding-decisions restaurant (#749), or outbox tips (#785 / #786). When #790
also lands, drop assertions in this tip that domain
`operationalFindingDecisions` still Unicode-trims `clientEventId` /
`idempotencyKey` (this tip currently asserts that main still does). When
landing #790 after this tip, #790 must drop its assertion that
`restaurantId` still uses `requireBoundedText(..., "Restaurant workspace", 64)`.

## Verification

- `tests/operationalFindingDecisionRestaurantAsciiC.test.ts`: focused inventing proofs
- `tests/operationalFindingDecisions.test.ts`: existing decision normalize suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
