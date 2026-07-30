# Mise Backend Security Readiness

Last updated: July 18, 2026

## Current Private-Beta Rule

Mise can be demoed with the replaceable local sample dataset and with hosted staging data only after the private-beta security gate passes. Do not invite real restaurants into a hosted project until tenant isolation has been verified against that hosted project.

Public restaurant data access must work like this:

- Expo clients use only `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and safe public app flags.
- Supabase Auth identifies the user.
- `restaurant_memberships` is the authorization source.
- Membership INSERT/UPDATE/DELETE is RPC-only; no user may mutate themselves and no client may change or remove an owner.
- Admins may manage manager/staff memberships only; owners may promote another active member to owner.
- Every restaurant-owned public table is scoped by `restaurant_id`.
- Every restaurant-owned public table has RLS enabled plus explicit `authenticated` grants for Supabase Data API access.
- Reviewed global service-only tables have forced RLS, no app-user policies or grants, and exact service-role CRUD; they never become restaurant data through a missing `restaurant_id`.
- No policy may use broad `USING (true)`, broad `WITH CHECK (true)`, `TO anon`, or deprecated `auth.role()`.
- Hosted demo seed/reset paths must fail closed. Demo data is local-only unless intentionally seeded into staging by an admin.

## Required Commands

Run this local-only gate before private-beta demos:

```bash
npm run verify:private-beta-security:local
```

That command runs:

- TypeScript typecheck.
- Unit and security regression tests.
- High-level npm audit.
- Expo Doctor dependency and app-config validation.
- Backend security static checks.
- Visual design static checks.
- Fresh local migration replay and pgTAP database assertions.
- Expo web export.
- Route smoke QA.
- Full mobile layout and demo-data interaction QA.

For a focused backend check, run:

```bash
npm run security:backend
```

`security:backend` includes `security:static` and then verifies RLS, client-facing and service-only Data API grants, restaurant-owned table shape, a statement-aware final inventory of public/private `SECURITY DEFINER` modes/search paths/grants, tenant Edge JWT/firewall calls, non-tenant endpoint authentication order, and the supported local Postgres version. Hosted checks are deliberately separate.

Current evidence: historical July 18 local/hosted gates passed for the then-current schema. July 30 adds `inventory_movements`, `account_deletion_requests`, and revokes authenticated DML on secondary POS/catalog/PO tables; re-run `npm run verify:private-beta-security` before inviting real restaurants. The reviewed catalog now targets 20 application plus 7 non-tenant service-only public tables and 4 private tables, with SELECT-only Data API access for inventory movements and account-deletion request rows.

The credentialed disposable-staging gate also passed on July 18, 2026 without skips. It proved rendered A-to-B request and mutation races across every tenant-sensitive screen, cross-tenant Data API denial across the 15 operational tables, immediate access loss after membership disable with the existing JWT, actor/tenant rechecks on every service-role operational RPC, forged-tenant denial across all five tenant Edge Functions, and the exact 8 accepted/12 rate-limited result for 20 concurrent POS reservations.

The local database command starts the Supabase database idempotently, performs a clean reset, and runs the pgTAP suite:

```bash
npm run supabase:test
```

## Hosted Staging Gate

Use a hosted staging Supabase project before inviting real beta restaurants.

1. Apply all migrations in `supabase/migrations`.
2. Load the trusted staging variables locally or from a protected CI context:

```bash
SUPABASE_STAGING_URL=...
SUPABASE_STAGING_PROJECT_REF=...
SUPABASE_STAGING_ANON_KEY=...
SUPABASE_STAGING_SECRET_KEY=...
MISE_STAGING_MARKER=...
MISE_STAGING_SEED_PASSWORD=...
```

The marker is a non-secret identity value configured only in the disposable staging database. The secret key is server-only and must never use an `EXPO_PUBLIC_` name, enter Expo configuration, be pasted into chat, or be committed.

3. Run the complete hosted gate:

```bash
npm run verify:private-beta-security:hosted
```

The hosted gate uses `staging:seed` to create Auth users through the trusted Auth Admin API, then runs the rendered client-race, tenant/workflow, service-RPC, and Edge-concurrency suites. It verifies:

- unauthenticated users cannot read restaurant data;
- managers can read and operate only their restaurant inventory, recommendations, orders, POS imports, AI insights, email state, supplier recipients, and setup metadata;
- every operational table denies a Tenant A manager's structurally valid Tenant C INSERT and Tenant B UPDATE/DELETE while the independently authorized Tenant B/C owner confirms the target fixtures remain intact;
- managers cannot read audit logs or manage memberships/email sender state;
- staff users remain read-only;
- owners/admins can manage only the role hierarchy allowed by guarded membership RPCs;
- disabling a membership immediately removes Data API, RPC, and Edge access for the existing token;
- cross-restaurant writes do not mutate the other restaurant;
- forged `actor_user_id` audit inserts are rejected;
- every service-role operational RPC rejects a service-key request whose supplied actor is not a live manager of the supplied restaurant;
- all five tenant Edge Functions reject a source-tenant-authorized caller who supplies another restaurant's ID;
- exactly 8 of 20 simultaneous POS sync reservations are accepted and the rest return 429;
- late list/detail responses and order mutation continuations never render under another workspace.

For final closure, run `npm run verify:private-beta-security`. The command checks hosted access before starting and fails if any required credential is absent; it never converts a skipped hosted check into success.

Observed July 18, 2026: `npm run verify:private-beta-security:hosted` passed in the disposable `Mise Staging Security` project without skipped checks. Re-run the combined command after any authorization, migration, Edge, or tenant-client change and before onboarding a real pilot restaurant.

## Edge Function Firewall Rules

The sensitive Edge Functions remain guarded server boundaries until live provider work is intentionally enabled:

- `sync-pos-sales`
- `generate-ai-insights`
- `link-gmail`
- `send-supplier-email`

Each function must:

- set `verify_jwt = true` in `supabase/config.toml`;
- call `requireAuthenticatedContext`;
- validate request fields with shared validators;
- call `reserveFunctionInvocation` before sensitive work;
- enforce restaurant role checks;
- record audit logs and security events;
- return generic missing-configuration messages without provider secret names.

`sync-pos-sales` and `generate-ai-insights` additionally fail closed after the live role check and request audit: they record one terminal `blocked` event, return a bounded `501`/`503` response, and create no queued import or placeholder insight. Live Square, Toast, Clover, Lightspeed, Gmail, supplier sending, and OpenAI execution remain disabled until backend-only credentials, staging verification, monitoring, and product/legal readiness are complete.

## Secret Handling

Never expose these in Expo, public env vars, client-readable tables, logs, test snapshots, or API responses:

- Supabase service role or secret key.
- Database password or JWT secret.
- POS access tokens.
- Gmail refresh/access tokens.
- Google client secret.
- SMTP passwords.
- Supplier credentials.
- OpenAI keys.

Allowed public Expo env vars are limited to:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ENABLE_DEMO_MODE`
- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_POSTHOG_KEY`
- `EXPO_PUBLIC_POSTHOG_HOST`

Provider credentials belong in backend-only Supabase Edge Function secrets or another server-only secret store.

## Private-Beta Blockers

Do not use real restaurant data until all are true:

- `npm run verify:private-beta-security` passes locally and against hosted staging without skips.
- Hosted staging migrations are applied.
- Hosted staging seed/check passes.
- No real provider secrets are present in Expo env vars.
- Local demo restore cannot touch hosted Supabase data.
- Testers understand POS/Gmail/OpenAI/supplier sending are readiness states only.

## Public-Launch Blockers

Before public App Store launch, Mise still needs:

- production Supabase staging-to-production promotion process;
- production monitoring and alert routing;
- real account deletion/privacy support;
- privacy policy and support URLs;
- Apple privacy questionnaire;
- real-device TestFlight QA;
- deliberate live provider integrations with backend-only credentials.
