# MISE-005LE — scheduled recalculation restaurant workspace ASCII C

Date: 2026-10-09

## Finding

`runScheduledRecalculations` used Unicode `input.restaurantId.trim()` before
dispatching due recalculation cycles. NBSP / em-space padding invents the
unpadded restaurant workspace identity on the Home/Today operator-session
dispatch path.

## Change

- Added `services/domain/scheduledRecalculationRestaurantIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `runScheduledRecalculations` through
  `canonicalizeScheduledRecalculationRestaurantId` so invalid / Unicode-padded
  tokens return `null` without inventing identity and without throwing into the
  operator screen.
- Preserved demo non-UUID workspace tokens (`restaurant_a`).
- Left timezone trim, recalculation-run transport (#734), recalculation-schedule
  (#733), and other restaurant tips untouched.

## Tests

- `tests/scheduledRecalculationRestaurantAsciiC.test.ts` — source pin, ordinary
  ASCII trim, NBSP/em-space inventing proofs, empty/control rejection, fail-soft
  dispatch returns.
- Focused tip suite — 4/4
- `npm run typecheck` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled
- `npm run security:static` + `security:backend` — pass
