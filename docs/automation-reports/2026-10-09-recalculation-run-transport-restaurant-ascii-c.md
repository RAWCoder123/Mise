# MISE-005LD recalculation-run transport restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-recalculation-run-transport-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

- Added `services/domain/recalculationRunTransportRestaurantIdentity.ts` with ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `recordRecalculationRunRpcArguments` restaurant workspace identity through `requireCanonicalRecalculationRunTransportRestaurantId`.
- Fail-closed error contract: `Recalculation run recording requires a restaurant.`
- Preserved demo non-UUID workspace tokens (`restaurant_a`).
- Left `scheduledRecalculations`, recalculation-schedule (#733), row-reader restaurant_id, and sibling restaurant tips untouched.

## Why

Unicode `String.prototype.trim()` strips NBSP and em-space. A padded restaurant workspace token would invent the unpadded identity before the hosted `record_recalculation_run` RPC, collapsing tenant scope silently on the write path.

## Tests

- `tests/recalculationRunTransportRestaurantAsciiC.test.ts` — source pin, ordinary ASCII trim, NBSP/em-space inventing proofs, empty/control rejection, row-reader scope guard.
