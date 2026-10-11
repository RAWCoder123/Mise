# MISE-005NJ finding-decision evidence identity ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-evidence-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `normalizeEvidence` (shared by `normalizeOperationalFindingDecisionInput`
and `normalizeOperationalFindingDecision`) normalized evidence `id` with
Unicode `String.prototype.trim()` via `requireBoundedText`. NBSP (`U+00A0`) or
em-space (`U+2003`) padding around a valid evidence token would still normalize
to that token, inventing a parallel evidence identity before decision RPC
argument construction and response normalization.

Open tip #790 pinned finding-decision object identities (`clientEventId` /
`idempotencyKey`) and intentionally left evidence identities alone. Open tip
#791 pinned restaurant workspace and also left evidence alone.

## Inventing proof

`'\u00a0item-chicken\u00a0'.trim() === 'item-chicken'` while ASCII-C
canonicalize returns `null` and normalize throws the existing
`Finding evidence identity is invalid.` contract.

Input `finding.id.trim()` is **not** inventing: the pattern gate tests the raw
id before trim, so Unicode padding fails closed with
`Finding identity is invalid.` before any trim can invent a token.

## Change

- Added `services/domain/operationalFindingDecisionEvidenceIdentity.ts`
  with ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `normalizeEvidence` evidence `id` through
  `requireCanonicalOperationalFindingDecisionEvidenceId`.
- Preserved require message `Finding evidence identity is invalid.` and the
  existing 240-character bound.
- Left evidence `type` / summary, restaurant workspace, `finding.id.trim()`,
  and client/idempotency object identities on Unicode trim for sibling tips.
- Left outbox tips (#785 / #786) untouched.

## Merge note

Alone-OK relative to open stacks through #791 and #192. Does not share identity
modules with finding-decision object identities (#790), restaurant workspace
(#791), or outbox tips (#785 / #786). When #790 lands, drop assertions in this
tip that domain `operationalFindingDecisions` still Unicode-trims
`clientEventId` / `idempotencyKey`. When #791 lands, drop the assertion that
`restaurantId` still uses `requireBoundedText(..., "Restaurant workspace", 64)`.

## Verification

- `tests/operationalFindingDecisionEvidenceAsciiC.test.ts`: focused inventing proofs
- `tests/operationalFindingDecisions.test.ts`: existing decision normalize suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
