# Home status menu-risk item deep-link — 2026-08-31

## Problem

Home's `RestaurantStatusCard` titled low-stock risks as "Low stock: …" but
`onPress` sent operators to `/orders` (when any approval existed) or `/today`.
Even after hub-level Inventory routing, operators still could not jump to the
named inventory item because `menuRisks` carried only `itemName`.

## Change

- `buildOutlook` now includes durable `itemId` on each menu risk from the
  inventory outlook item.
- `resolveRestaurantStatusCardHref` prefers `/inventory/{itemId}` when the
  leading menu risk has a safe id, then `/inventory`, `/orders`, `/today`.
- Home status card press uses that helper so title precedence matches
  navigation.
- Unit tests cover item deep-link, unsafe-id fallback, approval, and generic
  attention cases; operating-brief asserts `itemId` on critical outlooks.

## Paths

- `services/domain/operatingBrief.ts`
- `services/presentation/homeStatusPresentation.ts`
- `app/(tabs)/home.tsx`
- `tests/homeStatusPresentation.test.ts`
- `tests/operatingBrief.test.ts`
- `tests/dailyPhaseBrief.test.ts`

## Verification

- `npm run typecheck`
- `npm test` (includes new presentation + brief assertions)

## Out of scope

- Activity related-entity deep-links (separate stack)
- Contested inventory/orders authority changes
- Migrations
