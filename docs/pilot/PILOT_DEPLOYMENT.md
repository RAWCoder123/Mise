# First restaurant deployment

Mise's existing pilot deployment is an Expo/EAS iOS TestFlight client backed by
a dedicated hosted Supabase project (Auth, Postgres, Vault, and Edge Functions).
Staging and production must use different Supabase projects and provider apps.
No Kubernetes, Terraform, or server fleet is required.

## Environments

| Target | EAS profile | Supabase | Demo mode | Use |
| --- | --- | --- | --- | --- |
| Local development | `development` | local or none | on | engineering/demo |
| Internal preview | `preview` | staging Preview env | on | internal demo QA |
| Restaurant pilot | `testflight` | staging Preview env | **off** | restaurant #1 |
| Production | `production` | production env | off | not authorized by this milestone |

The `testflight` profile uses App Store distribution but the isolated EAS
Preview environment. Confirm the resolved config before every build; do not
assume the profile name supplies Supabase values.

## Configuration inventory

EAS public client variables (Preview for TestFlight):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- optional scrubbed observability keys: `EXPO_PUBLIC_SENTRY_DSN`,
  `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`

Never place a service key, database password, Square secret, Gmail secret, or
refresh token in an `EXPO_PUBLIC_` variable.

Founder-only local `.mise-staging.env` (never commit):

- `SUPABASE_STAGING_URL`
- `SUPABASE_STAGING_PROJECT_REF`
- `SUPABASE_STAGING_ANON_KEY`
- `SUPABASE_STAGING_SECRET_KEY`
- `MISE_STAGING_MARKER`
- `SUPABASE_PRODUCTION_PROJECT_REF` for negative target comparison

Supabase Edge secrets:

- Square: `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`,
  `SQUARE_REDIRECT_URI`, `SQUARE_ENVIRONMENT`,
  `MISE_APP_SQUARE_REDIRECT_URI`, and only for webhooks
  `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_NOTIFICATION_URL`.
- Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `MISE_APP_GMAIL_REDIRECT_URI`, `GMAIL_MESSAGE_ID_DOMAIN`,
  `GMAIL_SEND_ENABLED`.
- Observability: optional server-only `SENTRY_DSN`.

## Provider URLs

For project ref `<ref>`:

- Square OAuth callback:
  `https://<ref>.supabase.co/functions/v1/square-oauth-callback`
- Square webhook notification:
  `https://<ref>.supabase.co/functions/v1/square-webhooks`
- Gmail OAuth callback:
  `https://<ref>.supabase.co/functions/v1/gmail-oauth-callback`
- App return URIs: `mise://settings/pos` and `mise://settings/gmail`

Register the HTTPS callback with the provider exactly. The app return URI is an
Edge secret and receives only the bounded `square=` or `gmail=` status.

## Deployment order

1. Confirm clean exact candidate and dedicated staging project ref.
2. Run the full local gate, including a fresh `supabase db reset` and pgTAP.
3. Link the Supabase CLI to staging and review the migration diff. Apply the
   ordered migrations; never use `supabase/schema.sql` as deployment authority.
4. Set Edge secrets without printing them. Deploy at least:
   `link-square`, `square-oauth-callback`, `sync-pos-sales`, `square-webhooks`,
   `link-gmail`, `gmail-oauth-callback`, `send-supplier-email`,
   `operational-workflows`, `delete-account`, and `export-restaurant-data`.
5. Verify Auth remains invite-only and redirect allowlists contain
   `mise://accept-invite` and `mise://auth/callback`.
6. Run staging identity/security checks. Confirm every restaurant provider and
   drafting gate is off before admission.
7. Resolve the TestFlight configuration without exposing values:

   ```bash
   npx --yes eas-cli@21.4.0 whoami
   npx --yes eas-cli@21.4.0 config --platform ios --profile testflight --non-interactive
   npm run ios:testflight:check
   ```

   Verify `EXPO_PUBLIC_APP_ENV=staging`, demo mode false, project ID
   `bf74b605-68fb-4457-9eb8-e68b9c4aac0d`, and bundle ID `com.mise.mobile`.
8. Build with `npm run ios:testflight:build`, record the EAS build ID/commit,
   submit with `npm run ios:testflight:submit`, and install that exact build.
9. Provision only restaurant #1. Advance provider controls with
   `npm run pilot:controls` according to the onboarding checklist—never by
   authenticated client DML or ad hoc SQL. Applied commands require an active
   owner/admin actor UUID and stable request UUID. The service-only atomic RPC
   returns an immutable audit ID; record it with the deployment evidence.

## Manual external acceptance

Local tests do not claim provider acceptance. Before launch, record:

- Square sandbox OAuth callback, intended location list, fresh exact 28-day full
  sync, catalog identity, mapping queue, replay/overlap, disconnect/reconnect,
  signed two-day webhook, and preserved full authority semantics;
- Gmail OAuth/reconnect, founder-controlled recipient, exact reviewed content,
  one successful send, provider ID, durable finalization, definitive rejection,
  and a deliberately simulated unknown result with no retry;
- app Sentry/Edge logs and audit rows containing IDs/safe codes but no tokens.

Webhooks and real supplier cutover remain off until these receipts exist.

## Promotion and rollback

MISE-PILOT-001 does not authorize production promotion. For a bad client build,
disable external gates and restore the prior approved TestFlight build. For a
database defect, preserve immutable history and deploy an additive forward
repair after isolated restore/staging proof. Follow `PILOT_INCIDENT_PLAYBOOK.md`.
