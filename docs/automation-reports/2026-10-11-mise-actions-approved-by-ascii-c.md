# MISE-005NR: pin Mise-actions approvedBy to ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-actions-approved-by-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Domain `markApproved` / `markRejected` used Unicode `approvedBy.trim()` before
storing durable approval attribution. NBSP/em-space padding around a valid
approver token Unicode-trimmed to that token and invented a clean approver
identity.

`'\u00a0aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\u00a0'.trim()` equals the bare
UUID while ASCII-C canonicalize returns `null`. Soft empty (`"   "`) still
becomes `null` on approve and falls back on reject.

## Change

- Added `services/domain/miseActionsApprovedByIdentity.ts`
- Routed `markApproved` / `markRejected` through ASCII-C normalize helper
- Preserved `Mise action approvedBy is invalid.` for inventing / over-long /
  control / non-string inputs; length capped at 64
- Left restaurant (#738), domain object ids (#772), rollbackReference, error,
  lesson, and requestedBy alone

## Verification

- focused AsciiC + miseActions: 12/12
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 690 total / 0 fail (7 pre-existing recalculationCycles cancelledByParent flakes)

## Merge notes

Alone-OK. When landing with #772 drop the cross-assertion that
`idempotencyKey` still Unicode-trims. Keep modules separate; do not merge
error contracts with restaurant (#738) or finding-decision actor (#799).
