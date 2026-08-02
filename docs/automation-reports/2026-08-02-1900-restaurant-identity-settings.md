# Restaurant identity settings (2026-08-02)

## Gap
`updateRestaurantProfile` was already Edge-owned for owner/admin via `service_update_restaurant_profile`, and setup used it during onboarding, but Settings had no dedicated editor for restaurant name, address, cuisine, service style, timezone, or currency after day one.

## Change
- Domain helpers in `services/domain/restaurantIdentity.ts` for drafts, sparse patches, and selectable timezone/currency options.
- Session `applyRestaurantProfile` keeps active restaurant and workspace switcher lists in sync after saves.
- Settings → Restaurant identity (`/settings/restaurant`) with owner/admin edit + staff read-only modes; EN/ES/zh-Hans copy.
- Hub entry in the Restaurant section; Operations service row also deep-links to the editor.
- Unit and security contract tests; route smoke includes `/settings/restaurant`.

## Behavior
1. Hosted writes remain Edge `update_restaurant_profile` with server role checks (owner/admin only).
2. Client builds a sparse validated patch; empty address/cuisine clear to null.
3. Brand colors and logo URL are intentionally deferred to avoid a noisy first editor.
4. Demo mode persists through the local repository and session snapshot.

## Verification
- `npm run typecheck`
- `npm test` (391)
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes` (includes `/settings/restaurant`)
- Docker `supabase:test` still pending in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.
