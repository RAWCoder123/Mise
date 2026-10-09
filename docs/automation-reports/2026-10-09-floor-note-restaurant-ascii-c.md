# MISE-005LA floor-note restaurant workspace ASCII C

Date: 2026-10-09  
Base: `origin/main` @ `78da737`

## Gap

Unicode `.trim()` on floor-note / operator-task `restaurantId` could invent a
canonical workspace identity from NBSP / em-space padding before AsyncStorage
key construction and task CRUD. Demo tenants use non-UUID workspace tokens, so
this path cannot require UUID shape.

## Change

- Added `services/domain/floorNoteRestaurantIdentity.ts` with ASCII-only end
  trim, fail-closed canonicalize, and
  `requireCanonicalFloorNoteRestaurantId`.
- Routed `services/application/floorNotes.ts` `requireRestaurantId` through the
  helper; storage keys no longer re-apply Unicode trim.
- Preserved `Missing restaurant workspace.`
- Left title/body/dueAt/taskId trim, restaurant-memory (#not tipped),
  activity-event (#729), purchase-line (#728), and supplier-recipient (#727)
  restaurant tips untouched.

## Verification

- `npm run typecheck`
- Focused `tests/floorNoteRestaurantAsciiC.test.ts`
- Related `tests/floorNotes.test.ts`
- `npm run security:static`
- `npm run security:backend`
