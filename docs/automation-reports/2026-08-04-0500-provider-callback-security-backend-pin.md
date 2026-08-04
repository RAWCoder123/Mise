# Provider-callback security-backend pin

Date: 2026-08-04  
Branch: `cursor/mise-product-inspection-0d95`

## Gap

`scripts/security-static.mjs` already treated `gmail-oauth-callback` as a provider callback (`verify_jwt = false`, claim-before-secret ordering). `scripts/security-backend.mjs` only classified tenant, user-scoped, and account-onboarding Edge Functions. A new or regressing provider-callback function could therefore pass the private-beta backend security gate without callback-specific authority checks.

## Fix

- Classify every configured Edge Function as tenant, user-scoped, account-onboarding, provider-callback, or non-tenant.
- Fail closed when `supabase/config.toml` and the security-backend allowlists diverge.
- For `gmail-oauth-callback`, require:
  - intentional `verify_jwt = false`
  - no restaurant JWT membership guard
  - bounded OAuth state claimed before `googleOAuthConfig()`
  - service-owned complete/fail RPCs
  - terminal firewall security-event finalization
  - owner/admin firewall policy retained in migrations
- For outreach non-tenant functions, require `verify_jwt = false` and no restaurant membership guards.
- Add a security regression test covering the classification contract.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging remain unavailable in this environment.
