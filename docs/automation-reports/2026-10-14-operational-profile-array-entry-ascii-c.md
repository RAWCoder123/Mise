# MISE-005PR operational profile array-entry ASCII C

Date: 2026-10-14  
Branch: `cursor/mise-operational-profile-array-entry-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireBoundedStringArray` used `entry.trim()` and stored the
Unicode-trimmed result for operational profile `orderCadence`, `prepWindows`,
`primarySuppliers`, and `inventoryReviewDays`. Em-space / NBSP padding invented
a clean durable entry before `update_restaurant_profile` stored it
(`'\u2003Monday\u2003'.trim() === 'Monday'`).

ASCII C end-trim only leaves em-space / NBSP padding alone and fails closed
rather than inventing equality with the unpadded entry. Soft empty /
Unicode-only spaces stay empty so the prior `entries must be between 1 and 160
characters` contract remains.

## Change

- Add `services/domain/operationalProfileArrayEntryIdentity.ts` with ASCII C
  end-trim identity prep.
- Route `requireBoundedStringArray` through
  `normalizeCanonicalOperationalProfileArrayEntry`.
- Leave `requireNullableBoundedText` (logo URL / address until #850), notes
  inventing (#851 / MISE-005PQ), cuisine/name inventing, and hydrate
  `asStringArray` alone.
- Focused inventing proofs in `tests/operationalProfileArrayEntryAsciiC.test.ts`.

## Verification

- Focused AsciiC 4/4 + securityRemediation 12/12 (16/16 combined)
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #851. When landing with #851, keep
`operationalProfileArrayEntryIdentity.ts` separate from
`operationalProfileNotesIdentity.ts`. Leave logo URL inventing via remaining
`requireNullableBoundedText` for a later tip.
