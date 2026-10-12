# MISE-005OI: pin restaurant-tasks locationId to ASCII C

Date: 2026-10-12

## Inventing proof

Domain `optionalText` Unicode-trimmed `locationId` on
`restaurantTaskFromPersistedRow` only (create input does not carry locationId;
hosted rows may set `location_id` server-side or leave it null for
restaurant-wide tasks). NBSP / em-space padding invented a durable location
identity before hydrated task rows stored it:

- `'\u00a0location-1\u00a0'.trim() === 'location-1'`
- ASCII-C canonicalize returns `null` for the same padded token

Soft-empty values (ASCII whitespace or Unicode-only spaces) remain `null` — a
restaurant-wide task is ordinary. Non-string, over-long, control-bearing, or
Unicode-padded non-empty tokens throw `Location id is invalid.`

## Change

- Add `services/domain/restaurantTasksLocationIdIdentity.ts`
- Route hydrate `locationId` through
  `normalizeCanonicalRestaurantTasksLocationId`
- Leave sibling `requiredText` / `optionalText` surfaces (`restaurantId`,
  `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`, related
  ids, `createdBy`, `completedBy`, title/detail) on Unicode trim for separate
  tips

## Verification

- Focused `tests/restaurantTasksLocationIdAsciiC.test.ts`
- Existing `tests/restaurantTasks.test.ts`
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Merge

Alone-OK. Keep modules separate from #808–#816 sibling durable-key tips; do not
merge error contracts. When landing with sibling durable-key tips, drop mutual
Unicode-trim cross-assertions (especially tips that still assert `locationId`
Unicode-trims, and this tip's assertions that `assigneeUserId` / `createdBy` /
`completedBy` / `clientTaskId` / `dependencyIds` / related ids still
Unicode-trim).
