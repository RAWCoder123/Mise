# Terms of service URL scaffolding

Date: 2026-08-25  
Branch: `cursor/mise-product-inspection-terms-url`  
Baseline: `origin/main` @ `706590de293290d1dcfaf5bef82f27bd85c18fc5`

## Closed

1. HTTPS-only `EXPO_PUBLIC_TERMS_URL` via `normalizeOptionalHttpsUrl` / `PublicAppConfig.termsUrl`.
2. `/settings/terms` screen: fail-closed when URL missing/non-HTTPS; open button disabled until configured.
3. Settings Account row + Login / Accept-invite legal links (EN / ES / zh-Hans).
4. Security-static allowlist + `.env.example` + route/layout smoke coverage.

## Pins

- `tests/security.test.ts` HTTPS-only terms URL
- `tests/storePrivacySupport.test.ts` discoverability + fail-closed open wiring

## Founder still required

- Publish legal terms copy at an HTTPS URL.
- Set `EXPO_PUBLIC_TERMS_URL` in EAS/env for staging and production profiles.

## Do not redo

- Opening http/ftp/malformed terms destinations.
- Claiming the public terms page is live merely because scaffolding exists.
- Overlapping #130–#146 scopes.
