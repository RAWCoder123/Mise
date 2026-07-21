# Mise iOS Demo Readiness Automation Report

Run: 2026-06-23 02:47 America/New_York  
Automation: `mise-ios-demo-readiness`

## What changed

- Added count-only setup completion audit metadata in `services/domain/setupDrafts.ts`.
- Wired `saveRestaurantSetup` to write a tenant `audit_logs` event after setup persistence, purchase recommendation generation, and insight generation complete.
- Kept audit metadata limited to normalized counts: inventory items saved, supplier recipients saved, recipe mappings saved, attachment metadata saved, and skipped recipe ingredients.
- Added regression coverage that the audit metadata is normalized and does not include raw supplier names, emails, inventory names, recipe labels, attachment labels, tokens, or secrets.
- Updated paid-product readiness documentation to note setup completion audit observability.

## Files touched

- `services/domain/setupDrafts.ts`
- `services/miseService.ts`
- `tests/miseDomain.test.ts`
- `tests/security.test.ts`
- `docs/paid-product-readiness.md`
- `docs/automation-reports/2026-06-23-0247-setup-audit-observability.md`

## Verification

- `npm run typecheck` passed.
- `npm test` passed: 36 tests.
- `npm run security:static` passed.
- `npm run qa:routes` passed for `/`, `/login`, `/setup`, `/today`, `/inventory`, `/orders`, `/insights`, and `/settings`.

## Supabase references checked

- Supabase changelog: `https://supabase.com/changelog.md`
- Row Level Security guide: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Securing your API guide: `https://supabase.com/docs/guides/api/securing-your-api`

## Still needs to be done

- Run the iOS simulator or physical-device checklist from `docs/ios-demo-checklist.md`; web route and mobile-layout checks are passing, but native iOS has not been verified in this run.
- Apply the latest Supabase migrations to hosted staging and run `npm run staging:tenant-check` with staging credentials.
- Keep Gmail token exchange/storage backend-only before enabling live supplier email sends.

## Recommended next step

Run a native iOS simulator walkthrough with local demo mode first, then repeat against hosted Supabase staging once the setup persistence migrations are applied. If both pass, Mise is close to demoable for iOS users and the remaining work is launch checklist closure rather than core product readiness.
