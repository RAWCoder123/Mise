# MISE-005NH: pin finding-decision object identities to ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-finding-decision-object-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Unicode `String.prototype.trim()` strips NBSP and em-space. Domain
`normalizeOperationalFindingDecisionInput` routed `clientEventId` and
`idempotencyKey` through `requireBoundedText`, which Unicode-trimmed and then
stored the unpadded token. A padded device event identity therefore invented
the unpadded object identity before RPC argument construction.

## Change

- Add `services/domain/operationalFindingDecisionObjectIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Route `clientEventId` (max 200) and `idempotencyKey` (max 240) through the
  new requires, preserving
  `Finding decision event identity is invalid.` and
  `Finding decision idempotency key is invalid.`
- Leave restaurant workspace, `finding.id`, evidence identities, and free-text
  recommended actions on Unicode `requireBoundedText` / `.trim()` for later
  tips.
- Leave finding-decision outbox entry id (#785) and keyPrefix (#786) alone.

## Inventing proof

`'\u00a0device-event-1\u00a0'.trim() === 'device-event-1'` while ASCII-C
canonicalize returns `null` and normalize throws the existing invalid-identity
contract. On current main, normalize previously accepted the padded token as
the unpadded identity.

## Verification

- Focused tip suite: `tests/operationalFindingDecisionObjectAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`

## Merge notes

Alone-OK relative to #785 / #786 (outbox entry id / keyPrefix) and application
finding-decisions restaurant workspace #749. Do not bundle those tips here.
