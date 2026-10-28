# MISE-005SG: pin restaurant-autonomy restaurant_id hydrate to ASCII C

Date: 2026-10-28  
Base: `origin/main` @ `78da737`

## Finding

Unicode `row.restaurant_id.trim()` inside `autonomyRuleFromPersistedRow` invented
a restaurant workspace identity from NBSP/em-space padding
(`'\u2003restaurant_a\u2003'.trim() === 'restaurant_a'`) before tenant-scope
checks on listed/saved autonomy rules.

Open autonomy application tip #741 / MISE-005LK already pins
`fetchAutonomyRules` / `saveAutonomyRule` / `createSafeDefaultAutonomyRules`.
It does not own domain persisted-row hydrate.

## Change

- Added `services/domain/restaurantAutonomyRestaurantIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed domain `autonomyRuleFromPersistedRow` through
  `requireCanonicalRestaurantAutonomyRestaurantId`.
- Fail-closed message: `Restaurant autonomy requires a restaurant id.`
- Left application tip #741, spend-limit (#888), allowed-window (#878),
  communicationType (#877), and `defaultAutonomyRules` pass-through alone.

## Inventing proof

Prior hydrate Unicode-trimmed and used the trimmed result. ASCII C prep leaves
em-space / NBSP alone and does not invent equality with the unpadded workspace.

## Verification

- Focused: `tests/restaurantAutonomyRestaurantAsciiC.test.ts`
- `npm run typecheck`
- `npm test`
- `npm run security:static` / `npm run security:backend`

## Do not

- Re-tip this restaurant-autonomy restaurant_id hydrate path after merge.
- Tip application autonomy restaurant workspace again (#741).
- Bundle sibling restaurant-workspace tips in the same PR.
- Add a UUID shape requirement on this restaurant_id path.
