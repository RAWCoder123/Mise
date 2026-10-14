# MISE-005PQ operational profile notes ASCII C

Date: 2026-10-14  
Branch: `cursor/mise-operational-profile-notes-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

miseValidation `requireRestaurantOperationalProfile` used
`requireNullableBoundedText` → `value.trim()` and stored the Unicode-trimmed
result for operational profile notes. Em-space / NBSP padding invented a clean
free-text body before `update_restaurant_profile` stored it
(`'\u2003Count before ordering\u2003'.trim() === 'Count before ordering'`).

ASCII C multiline free-text prep (NBSP fold + C-end trim only; preserve
internal LF/TAB/CR) leaves em-space alone and does not invent equality with
the unpadded note. Soft empty / Unicode-only spaces stay soft-null as before.

## Change

- Add `services/domain/operationalProfileNotesIdentity.ts` with ASCII C
  multiline free-text prep.
- Export `requireOperationalProfileNotes` in `miseValidation.ts`; route
  operational profile notes through it.
- Leave `requireNullableBoundedText` (logo URL / address until #850), address
  tip (#850 / MISE-005PP), cuisine/name inventing, hydrate
  `asNullableString(profile.notes)`, and `requireBoundedStringArray` entry
  trim alone.
- Focused inventing proofs in `tests/operationalProfileNotesAsciiC.test.ts`.

## Verification

- Focused AsciiC 4/4 + securityRemediation 12/12 (16/16 combined)
- `npm run typecheck` pass
- `npm run security:static` / `security:backend` pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #850. When landing with #850, drop #850's assertion that notes
still call `requireNullableBoundedText` / still Unicode-trim via that helper.
Keep `operationalProfileNotesIdentity.ts` separate from
`restaurantAddressIdentity.ts` / `supplierOperatorNoteIdentity.ts`. Leave
`requireBoundedStringArray` inventing for a later tip.
