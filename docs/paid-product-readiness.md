# Mise Paid Product Readiness

## What is implemented

- Setup drafts persist into tenant-scoped restaurant data:
  - inventory baselines become `inventory_items`
  - supplier names and emails become `supplier_recipients`
  - recipe ingredient baselines become `menu_item_ingredients`
  - CSV/screenshot setup imports become `setup_attachments` metadata only
  - setup completion writes a tenant `audit_logs` event with count-only metadata
- Today is backed by restaurant-scoped source state:
  - operational tasks are derived from inventory, recommendations, supplier drafts, setup readiness, POS integrations, and active insights
  - task IDs are stable, role requirements are explicit, date-only commitments are not presented as fabricated exact times, and completion comes from the authoritative workflow rather than a standalone checkbox
  - Inventory Health reconciles Good, Watch, Low, and Critical counts and handles an empty inventory without a divide-by-zero percentage
  - the sales trend uses recorded restaurant sales instead of generated fallback values
- Inventory and ordering logic now covers finite/nonnegative anomaly handling, unit-compatible recipe depletion, bounded learning, ceil-safe reorder quantities, handled-recommendation suppression, replay-safe rebuilds, supplier grouping, and restaurant-timezone delivery dates.
- Operator locale preference supports English, Spanish, and Simplified Chinese/Mandarin (`zh-Hans`). It defaults from the supported device locale, persists locally in demo mode, and uses authenticated identity-derived RPCs in hosted mode. Navigation, setup, operational screens, details, integrations, validation, accessibility labels, and number/currency/date/relative-time formatting are localized while restaurant-entered names remain unchanged.
- Gmail remains backend-only and is no longer just scaffolding:
  - `link-gmail` and `gmail-oauth-callback` implement authorization-code OAuth with one-time state and S256 PKCE
  - the requested Google permissions are identity scopes plus the minimum `gmail.send` scope
  - refresh credentials and PKCE verifiers are encrypted through Supabase Vault; access tokens remain ephemeral and Expo receives only safe connection metadata/authorization URLs
  - owner/admin users can connect, reconnect, and revoke; an authorized manager can send through an existing connection
  - delivery claims are idempotent, ambiguous provider outcomes require review, and an order becomes sent only after Gmail accepts the message and returns a provider message ID
  - mocked provider/static tests exercise OAuth, refresh, MIME construction, error classes, Vault boundaries, tenant/role enforcement, and duplicate-send protection without contacting Google
- Client telemetry is typed and scrubbed. Public staging env vars can enable Sentry-style error capture and PostHog events without adding backend secrets to Expo. Supabase Edge Functions can capture unexpected failures with a server-only `SENTRY_DSN`.

## Verification truth

The prior July 18 Docker/staging closure predates the Gmail, locale, and supplier-recipient migrations. The current code-level gate passes TypeScript, 156/156 tests, dependency audit, Expo Doctor, backend security, design checks, frozen Edge Function checks, web export, and 390px/320px route and interaction QA. Docker was unavailable during this production-candidate pass, so the latest complete migration chain has not yet passed the local pgTAP gate or a fresh credentialed hosted-staging run. Live Google OAuth and supplier delivery are also intentionally unverified: no real email was sent, and `GMAIL_SEND_ENABLED` must remain unset/false until an approved test account, recipient, consent screen, and staging review are available.

## Staging proof steps

1. Apply every migration, including `20260719062148_gmail_backend_oauth_delivery.sql`, `20260719062921_add_operator_locale_preference.sql`, and `20260719214822_supplier_recipient_management.sql`, to the hosted Supabase staging project.
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

4. The combined command requires Docker for the local database phase and trusted staging access for the hosted phase. It fails rather than skipping either phase.
5. Separately follow `docs/gmail-backend.md` with approved Google staging credentials. Verify connect, callback, refresh, Workspace restrictions, revoke/reconnect, successful delivery, duplicate prevention, invalid-recipient handling, and ambiguous-delivery review before enabling live sends.

## Remaining before paid public launch

- Pass the complete Docker-backed and hosted-staging security gates with the latest migrations.
- Complete approved live verification of the implemented Gmail backend; keep sending disabled until that sign-off.
- Implement and verify the first live POS provider adapter server-side.
- Add official production monitoring/alerting and define backup, restore, and incident-response procedures.
- Complete real-device iPhone QA, EAS/TestFlight validation, App Store screenshots/metadata, and Apple credential/review work.
- Publish support and privacy-policy URLs, complete the Apple privacy questionnaire, and provide an in-app account-deletion path or documented deletion process.
- Perform a load/performance pass with restaurant-sized data and add billing/subscriptions before charging customers.
