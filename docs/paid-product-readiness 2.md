# Mise Paid Product Readiness

## What is implemented

- Setup drafts now persist into tenant-scoped restaurant data:
  - inventory baselines become `inventory_items`
  - supplier names and emails become `supplier_recipients`
  - recipe ingredient baselines become `menu_item_ingredients`
  - CSV/screenshot setup imports become `setup_attachments` metadata only
  - setup completion writes a tenant `audit_logs` event with count-only metadata
- Gmail remains backend-only. Expo can read connection status and prepare/copy order payloads, but live sending stays disabled until the OAuth token store is implemented server-side.
- Client telemetry is typed and scrubbed. Public staging env vars can enable Sentry-style error capture and PostHog events without adding backend secrets to Expo.
- Supabase Edge Functions can capture unexpected failures with a server-only `SENTRY_DSN`.

## Staging proof steps

1. Apply migrations to the hosted Supabase staging project.
2. Load the staging values from a trusted local or protected CI secret store:

```bash
SUPABASE_STAGING_URL=...
SUPABASE_STAGING_PROJECT_REF=...
SUPABASE_STAGING_ANON_KEY=...
SUPABASE_STAGING_SECRET_KEY=...
MISE_STAGING_MARKER=...
MISE_STAGING_SEED_PASSWORD=...
```

3. Run the fail-closed local and hosted closure gate:

```bash
npm run verify:private-beta-security
```

4. The same combined command requires Docker for the local database phase and trusted staging access for the hosted phase. It fails rather than skipping either phase.

## Remaining before paid public launch

- Use hosted staging credentials to run the seed and tenant checks against a real Supabase project.
- Implement Google OAuth token exchange/storage in a backend-only store before enabling supplier email send.
- Add official Sentry/PostHog SDKs if the lightweight telemetry shim is not enough for release monitoring.
- Add hosted CI secrets for Supabase local/staging database tests.
