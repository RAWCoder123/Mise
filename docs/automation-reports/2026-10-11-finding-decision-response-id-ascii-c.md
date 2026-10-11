# MISE-005NN: pin finding-decision response decision id to ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-response-id-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.prototype.trim()` strips NBSP and em-space. Domain
`normalizeOperationalFindingDecision` routed response decision `id` through
`requireBoundedText(..., "Finding decision identity", 64)`, which
Unicode-trimmed padding away. A padded decision identity therefore invented a
valid unpadded decision id used as manager-feedback authority.

## Change

- Add `services/domain/operationalFindingDecisionResponseIdIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Route response decision `id` (max 64) through the new require, preserving
  `Finding decision identity is invalid.`
- Leave response `finding_id`, response enums, evidence type/id/summary,
  restaurant workspace, object identities, response actor / client event /
  idempotency, and outbox tips alone.

## Inventing proof

`'\u00a0dddddddd-dddd-4ddd-8ddd-dddddddddddd\u00a0'.trim() === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'`
while ASCII-C canonicalize returns `null` and response normalize throws
`Finding decision identity is invalid.` On current main, response normalize
previously accepted the padded token as the unpadded decision identity.

## Verification

- Focused tip suite: `tests/operationalFindingDecisionResponseIdAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK relative to #790–#795 and outbox tips #785/#786. When landing with
#795, drop this tip's cross-assertion that response `finding_id` still uses
`requireBoundedText`. When landing with #790/#791/#792/#793/#794, drop
cross-assertions that those sibling fields still Unicode-trim (this tip asserts
they remain on Unicode `requireBoundedText` until those tips land). Do not merge
error contracts with actor / client event / idempotency tips.
