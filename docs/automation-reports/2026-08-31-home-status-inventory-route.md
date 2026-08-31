# Home RestaurantStatusCard inventory routing — 2026-08-31

## Problem

Home's `RestaurantStatusCard` titled low-stock risks as "Low stock: …" but
`onPress` always sent operators to `/orders` when any approval existed, otherwise
`/today`. Inventory never received the tap even when the headline named a
menu-risk item.

## Change

- Added `resolveRestaurantStatusCardHref` so title precedence (menu risk →
  approval → generic) matches navigation (`/inventory` → `/orders` → `/today`).
- Wired Home status card press through that helper.
- Unit tests cover the three precedence cases.

## Paths

- `services/presentation/homeStatusPresentation.ts`
- `app/(tabs)/home.tsx`
- `tests/homeStatusPresentation.test.ts`

## Verification

- `npm run typecheck`
- `npm test -- tests/homeStatusPresentation.test.ts`
- broader `npm test` as available

## Out of scope

- Deep-link to a specific inventory item (menuRisks still lack item IDs)
- Contested inventory/orders authority changes
- Migrations
