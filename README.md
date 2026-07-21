# Mise

Mise is a mobile-first Expo app for independent restaurants: authoritative Today tasks, recipe baselines, observed POS sales trends, inventory health and predictions, operator-approved supplier orders, and operational insights.

## Run

```bash
npm install
npm run web
npm run ios
```

The app works immediately in demo mode and stores changes locally on the device/browser. To use Supabase persistence, create a Supabase project, apply `supabase/migrations/*.sql` in order, then add:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_ENABLE_DEMO_MODE=false
EXPO_PUBLIC_APP_ENV=production
```

For local demo-only development, set `EXPO_PUBLIC_ENABLE_DEMO_MODE=true` and leave Supabase keys empty. Demo mode stores data locally and is intentionally separated from real authenticated restaurant workspaces.

## Supabase Beta Setup

The Supabase schema is multi-tenant: restaurant-owned tables are scoped by `restaurant_id`, RLS policies call private membership helpers, and restaurant creation goes through `create_restaurant_with_owner`. Treat `supabase/schema.sql` as a legacy reference snapshot; beta/staging/production environments should be built from the ordered migrations.

With the Supabase CLI installed:

```bash
supabase start
supabase db reset
npm run supabase:test
```

For a hosted project, apply the migrations in order, then create beta users through Supabase Auth. A user must have an active `restaurant_memberships` row before they can see a restaurant. If they have none, Mise routes them through secure restaurant creation.

The second migration adds the restaurant operations backbone:

- `restaurants` carries brand colors, optional logo URL, timezone, currency, service style, and an `operational_profile`.
- `pos_integrations` stores provider connection state and sync cursors, not POS secrets.
- `sales_imports` records POS sync/import runs.
- `supplier_items` stores the restaurant-specific supplier catalog.
- `purchase_orders` is ready for real submitted/received orders beyond copyable drafts.
- `ai_insights` stores structured AI/rules output before it becomes operator-facing insight cards.
- `audit_logs` records tenant-scoped operational events.

The third migration tightens beta security by limiting legacy `users` updates to display names, adding cross-tenant foreign-key guards for inventory/POS child tables, and requiring client-written audit logs to use the current authenticated user as the actor.

All of these tables are scoped by `restaurant_id`, protected by membership-based RLS, and exposed to the client only through service/repository functions. POS credentials, supplier credentials, OAuth credentials, and OpenAI keys stay out of Expo public environment variables and client-readable tables. Gmail refresh credentials are encrypted through Supabase Vault, access tokens remain ephemeral in Edge Functions, and Google client credentials are backend-only secrets.

Operator language preference is allowlisted to English, Spanish, or Simplified Chinese/Mandarin (`zh-Hans`). Demo mode persists it in local storage; hosted mode reads and writes only the authenticated operator's profile through identity-free RPCs. Navigation, setup, Today, Inventory, Orders, Insights, Settings, detail/integration routes, validation, accessibility labels, and locale-aware numbers, currency, dates, and due-time labels use the supported locale. Restaurant, supplier, provider, menu, and item names remain unchanged.

## Private Beta Verification

For a fast code-level check, run the non-Docker beta gate:

```bash
npm run verify:beta
```

This is not sufficient to invite real restaurants. The complete latest migration chain must also pass the Docker-backed database proof and a credentialed hosted-staging run.

For a focused route check while iterating on iOS demo screens:

```bash
npm run doctor
npm run qa:routes
npm run qa:mobile-layout
npm run qa:interactions
```

Run the database RLS proof where Docker is available:

```bash
npx supabase start
npm run supabase:test
```

The database tests live in `supabase/tests/database` and exercise real RLS behavior for owners, managers, staff, unauthenticated users, cross-restaurant reads/writes, and audit-log actor enforcement. CircleCI runs Expo Doctor plus the complete layout/interaction demo proof in `verify`, installs Chrome through the pinned `circleci/browser-tools` orb before browser QA, and runs the local Supabase proof separately in `db_security`.

Mise includes authenticated backend workflows with distinct readiness levels:

- `sync-pos-sales` accepts `{ restaurantId, provider, from, to }`, checks the live restaurant role, and fails closed with `501` or `503` until a provider is deliberately enabled. It does not create queued or failed `sales_imports` rows for unavailable provider work.
- `generate-ai-insights` accepts `{ restaurantId }`, checks the live restaurant role, and fails closed with `501` or `503` until a model provider is deliberately enabled. It does not persist placeholder `ai_insights`.
- `operational-workflows` performs tenant-scoped, server-owned inventory, recipe, recommendation, and insight mutations.
- `link-gmail`, `gmail-oauth-callback`, and `send-supplier-email` implement backend-only Google authorization-code OAuth with one-time state, S256 PKCE, least-privilege `gmail.send`, refresh credentials in Supabase Vault, provider-message idempotency, and sent-state changes only after Gmail acceptance.

POS sync and model generation remain disabled behind explicit server boundaries; they return unavailable responses and do not perform provider calls or create misleading work records. The Gmail path is implemented and covered with mocked provider tests, but live OAuth and email delivery remain disabled and unverified until approved Google credentials, consent configuration, a designated test account, and an approved recipient are available. See [docs/gmail-backend.md](docs/gmail-backend.md) before setting `GMAIL_SEND_ENABLED=true`.

## Mise Outreach Agent

The repository includes a separate, service-only outreach agent for Mise's own restaurant sales. It imports traceable business contacts, requires lead and campaign approval, creates personalized reviewable drafts, sends through Resend within bounded local-time windows, and stops on unsubscribes, replies, hard bounces, complaints, or provider suppressions. It is not exposed in the restaurant Expo client and does not change supplier-email behavior.

See [docs/outreach-agent.md](docs/outreach-agent.md) for deployment, campaign setup, webhook, review, and scheduling instructions. Live sending remains off until the Edge Function secrets are configured and a campaign is explicitly activated.

## iOS Demo

Mise includes Expo iOS identity metadata, a demo app icon, and an `expo-splash-screen` launch mark in `app.json`. Before sharing a build or walkthrough, run `npm run qa:ios-prereq`, then use `docs/ios-demo-checklist.md` to verify the first-run local demo path, route fit, and operator flow.

## Core Flow

1. Sign in or continue with the demo kitchen.
2. Map baseline ingredients per dish so POS sales can deplete inventory.
3. Review observed sales, Inventory Health, and the role-aware Today task queue.
4. Update inventory counts.
5. Approve low-stock purchase recommendations.
6. Copy/edit supplier drafts or, after an approved Gmail connection, send them through the backend delivery workflow.
7. Review evidence-backed operational insights and observed sales trends.
8. Choose English, Spanish, or Simplified Chinese in Settings; restaurant, supplier, and menu-item names remain unchanged.

## Recommended Stack

- Client: Expo Router, React Native, React Native Web, TypeScript, and Mise's custom design primitives.
- Backend MVP: Supabase Auth, Postgres, Row Level Security, and Edge Functions when server-side jobs are needed.
- Domain layer: pure TypeScript services for recipe coverage, inventory outlooks, recommendations, insights, and supplier drafts.
- Operator command center: source-derived Today tasks with stable IDs, restaurant-timezone due dates, role requirements, and completion derived from authoritative workflow state rather than a cosmetic checkbox.
- Validation/contracts: Zod for structured AI output and integration payload boundaries.
- POS readiness: provider adapters in `services/integrations/` with live Square/Toast/Clover sync reserved for server-side Edge Functions.
- AI product layer: OpenAI Structured Outputs can feed `ai_insights` through `services/ai/structuredInsights.ts` once server-side API keys are configured.
- Engineering harness now: Codex app/CLI with `AGENTS.md`, browser QA, typecheck, tests, and optional MCP integrations for docs or Figma.
