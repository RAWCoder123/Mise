# Operating profile settings (2026-08-31)

## Gap
`restaurants.operational_profile` (order cadence, prep windows, inventory review
days, notes) is written during setup and consumed by Today’s operating plan, but
Settings had no post-setup editor. Identity settings (#223) cover name/timezone/
currency only.

## Change
- Domain helpers in `services/domain/restaurantOperatingProfile.ts`
- Settings screen `/settings/operating-profile` for owners/admins (staff read-only)
- Session `applyRestaurantProfile` so active restaurant reflects saves
- EN/ES/zh-Hans catalog keys; Operations hub entry; route smoke registration
- Preserves free-text `primarySuppliers` (authority remains on Suppliers)
- Hosted writes stay on authenticated RPC `update_restaurant_profile`

## Verification
- `npm run typecheck`
- `npx tsx --test tests/restaurantOperatingProfile.test.ts tests/restaurantOperatingProfileSecurity.test.ts`
- `npm test` (full suite)
- `npm run security:backend` (if available)

## Classification
Controlled pilot incremental. Does not change App Store readiness classification.
