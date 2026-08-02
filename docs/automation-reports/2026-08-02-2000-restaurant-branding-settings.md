# Restaurant branding settings (2026-08-02)

## Gap
Restaurant identity settings covered name/address/cuisine/service style/timezone/currency, but owners still could not change `brand_color`, `accent_color`, or HTTPS `logo_url` after onboarding. Catalog copy explicitly deferred brand colors and logos.

## Change
- Extended `services/domain/restaurantIdentity.ts` with brand/accent/logo draft fields, curated presets, hex validation helper, and sparse patching (including logo clear → `null`).
- Settings `/settings/restaurant` now includes live brand preview, preset swatches, hex inputs, HTTPS logo URL + clear control, and EN/ES/zh-Hans copy updates.
- Owner/admin gate and Edge `update_restaurant_profile` write path unchanged; staff remains read-only.
- Unit + security contract tests updated for branding fields.

## Behavior
1. Hosted writes remain Edge-owned with server role checks.
2. Invalid hex/logo values fail closed before save; validation surfaces localized errors.
3. Case-only hex edits do not create no-op patches.
4. Demo mode persists through the local repository and session snapshot.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` still pending in this environment

## Classification
Still **controlled pilot-ready** pending Docker/hosted re-proof and founder App Store/credentials steps.
