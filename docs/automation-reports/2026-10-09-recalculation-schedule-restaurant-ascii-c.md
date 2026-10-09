# MISE-005LC recalculation-schedule restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-recalculation-schedule-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

- Added `services/domain/recalculationScheduleRestaurantIdentity.ts` with ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `buildRecalculationSchedule` restaurant workspace identity through `requireCanonicalRecalculationScheduleRestaurantId`.
- Preserved the existing `Recalculation scheduling requires a restaurant.` error contract and demo non-UUID workspace tokens.
- Left `recalculationRunTransport`, `scheduledRecalculations`, timezone trim, and sibling restaurant tips untouched.

## Why

Unicode `String.prototype.trim()` strips NBSP and em-space. A padded restaurant workspace token would invent the unpadded identity before idempotency keys and cross-restaurant run checks, collapsing tenant scope silently.

## Tests

- `tests/recalculationScheduleRestaurantAsciiC.test.ts` — source pin, ordinary ASCII trim, NBSP/em-space inventing proofs, empty/control rejection.
