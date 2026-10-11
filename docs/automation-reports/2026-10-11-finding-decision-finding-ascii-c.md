# MISE-005NM: pin finding-decision response finding_id to ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-product-inspection-66bc`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.prototype.trim()` strips NBSP and em-space. Domain
`normalizeOperationalFindingDecision` routed response `finding_id` through
`requireBoundedText`, which Unicode-trimmed and then pattern-checked the
unpadded token. A padded finding identity therefore invented a valid
`finding:...` identity on the response path.

Input-path `finding.id` already fail-closes: the pattern gate tests the raw
token before `.trim()`, so NBSP/em-space padding never invents an identity
there and is left unchanged in this tip.

## Change

- Add `services/domain/operationalFindingDecisionFindingIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Route response `finding_id` (max 240) through the new require, preserving
  `Finding identity is invalid.` and the existing finding-id pattern check in
  the caller.
- Leave input `finding.id`, response enums, evidence type/id/summary,
  restaurant workspace, object identities, decision `id` / actor / client
  event / idempotency, and outbox tips alone.

## Inventing proof

`'\u00a0finding:inventory:low_stock:item1\u00a0'.trim() === 'finding:inventory:low_stock:item1'`
while ASCII-C canonicalize returns `null` and response normalize throws
`Finding identity is invalid.` On current main, response normalize previously
accepted the padded token as the unpadded finding identity.

## Verification

- Focused tip suite: `tests/operationalFindingDecisionFindingAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK relative to #790–#794 and outbox tips #785/#786. When landing with
#794, drop the cross-assertion that response `finding_id` still uses
`requireBoundedText`. When landing with #790/#791/#792/#793, drop
cross-assertions that those sibling fields still Unicode-trim (this tip asserts
they remain on Unicode `requireBoundedText` until those tips land).
