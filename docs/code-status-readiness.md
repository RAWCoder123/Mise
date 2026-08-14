# Mise Code And Readiness Status — HISTORICAL

Status: **SUPERSEDED**

> Historical document.
> This file describes Mise before repository consolidation.
> Do not use it as the current implementation source of truth.
> Current state: `docs/implementation/STATE.md`.

Last updated: July 19, 2026

## Executive Summary

Mise is a mobile-first restaurant operations app built with Expo Router, React Native, TypeScript, Supabase, and a custom in-app design system. The tenant-isolated product now includes authoritative Today tasks, real inventory-health and observed-sales summaries, hardened inventory/order algorithms, localized operator workflows in three languages, guarded supplier recipients, and a production-oriented Gmail OAuth/delivery backend. It remains suitable for local demos and internal walkthroughs, but it is not ready for a paid public App Store launch because the latest database changes, live providers, production operations, real-device behavior, Apple metadata, and legal/privacy flows still require external verification.

Current readiness level: production-candidate code with private-beta foundations; latest-migration staging proof and live-provider approval are still required before a real-restaurant pilot.

The July 18 tenant-isolation closure was green at both required boundaries: its then-current migration chain passed the Docker-backed pgTAP gate and the disposable-staging proof. Later July 19 migrations add Gmail OAuth/delivery, operator locale preference, and guarded supplier-recipient management. Their focused static/mocked coverage and new pgTAP suites are present, but the complete migration chain has not yet been rerun through Docker or credentialed staging in this finalization workspace. The July 18 result is historical evidence, not a release sign-off for the new schema.

Tenant authorization now follows one invariant: authenticated user, live active membership, permitted role, then restaurant-scoped resource. Direct membership/profile authority has been removed from Data API table writes, and the architecture matrix is documented in `docs/tenant-isolation-architecture-2026-07-16.md`.

Not yet ready for: public App Store release, live POS sync, enabling Gmail for customers, direct supplier-API submission, or paid production customers. Gmail's backend is implemented, but live OAuth and delivery remain default-off and unverified without approved Google credentials and recipients.

## Product Scope Implemented

Mise currently focuses on the right core restaurant workflows:

- Restaurant setup and onboarding.
- Inventory baseline entry and count updates.
- Recipe ingredient baselines.
- POS/demo sales data.
- Inventory predictions and coverage outlooks.
- Inventory Health with reconciled Good, Watch, Low, and Critical counts plus zero-safe well-stocked percentage.
- Restaurant-specific rolling demand memory from the last 28 service days, with anomaly resistance and evidence labels.
- Finite/nonnegative anomaly handling, unit-compatible recipe depletion, ceil-safe reorder quantities, suppression/idempotency boundaries, supplier grouping, and restaurant-calendar delivery dates.
- Purchase recommendations.
- Supplier draft orders.
- Order approval, dismissal, undo, copy, and sent-history flow.
- Gmail OAuth and supplier-email backend with PKCE, Vault storage, idempotent delivery, and provider-accepted sent state.
- Source-derived Today tasks with stable IDs, role tiers, restaurant-timezone due labels, deep links, and completion derived from the underlying workflow.
- Observed restaurant sales trends and operational insights.
- English, Spanish, and Simplified Chinese/Mandarin operator workflows with local-demo and authenticated-profile persistence.
- Restaurant-specific profile, branding, POS readiness, and recipe settings.
- Replaceable local demo dataset with one year of weekly sample data.

The app intentionally does not include payroll, scheduling, reservations, loyalty, payments, marketplace behavior, autonomous ordering, or direct supplier-API submission. Supplier email always remains an operator-approved action.

## Frontend Structure

The app uses Expo Router with the main route structure in `app/`:

- `app/(auth)/login.tsx`: login and local demo entry.
- `app/(auth)/setup.tsx`: guided restaurant setup.
- `app/(tabs)/today.tsx`: command center with operational KPIs, Inventory Health, authoritative tasks, and observed sales trend.
- `app/(tabs)/inventory.tsx`: inventory list, filtering, and count state.
- `app/(tabs)/orders.tsx`: supplier drafts, recommendations, undo lane, Gmail readiness.
- `app/(tabs)/insights.tsx`: operational insights and analytics when data supports them.
- `app/(tabs)/settings.tsx`: restaurant, safety, demo, and configuration surfaces.
- `app/inventory/[id].tsx`: inventory detail.
- `app/orders/[id].tsx`: supplier order detail.
- `app/settings/pos.tsx`: POS readiness.
- `app/settings/recipes.tsx`: recipe baseline readiness.
- `app/settings/language.tsx`: English, Spanish, and Simplified Chinese/Mandarin operator preference.
- `app/settings/gmail.tsx`: restaurant Gmail connection, reconnect, revoke, and safe demo disclosure.
- `app/settings/suppliers.tsx`: restaurant-scoped supplier email recipients and recovery.

The UI system is centralized in `components/ui/` and `constants/theme.ts`. Core primitives include `Screen`, `Card`, `Button`, `IconBadge`, `ActionIcon`, `MetricCard`, `CommandTile`, `OperationalListRow`, `ChartPanel`, `ConnectionRow`, `EmptyState`, `SetupStepRail`, and custom Mise illustrations.

Current visual direction:

- White surfaces.
- Black typography.
- Mise red for action and urgency.
- Warm neutral backgrounds, dividers, disabled states, and supporting copy.
- Consistent 44px icon/touch targets.
- Compact, scan-first cards and rows.
- Gmail is treated as a neutral third-party logo frame rather than a Mise-red alert.

## Backend And Service Structure

The backend-facing app logic is separated into clear layers:

- `services/miseService.ts`: screen-facing service API.
- `services/domain/miseDomain.ts`: pure inventory, recommendation, insight, supplier draft, and summary logic.
- `services/domain/setupDrafts.ts`: setup/import draft validation and readiness helpers.
- `services/domain/operationalSignals.ts`: deterministic Deno/Expo-compatible server-owned recommendation and insight calculation.
- `services/domain/todayTasks.ts`: authoritative, tenant-scoped operational task projections and timezone/role sorting.
- `services/domain/inventoryUnits.ts`: shared purchasing/recipe unit compatibility.
- `services/domain/securityLimits.ts`: shared supplier-note, order-message, and restaurant-name bounds.
- `services/repositories/miseRepository.ts`: facade over `repositoryContracts.ts` (interface + shared types), `supabaseRepository.ts` (hosted backend), and `demoRepository.ts` (local demo backend).
- `services/miseValidation.ts`: tolerant read normalization plus strict mutation validation and operating bounds.
- `services/tenantAccess.ts`: membership and role access helpers.
- `services/telemetry.ts`: typed telemetry with secret redaction.
- `services/integrations/posAdapters.ts`: safe POS adapter contracts.
- `services/ai/structuredInsights.ts`: structured AI output contracts.
- `contexts/LocaleContext.tsx`, `i18n/`, and `services/localePreferences.ts`: typed translation/formatting foundation and identity-safe preference persistence.

This is the right shape for the current stage: UI screens consume stable service functions, while pure business logic remains testable and provider-agnostic.

## Data Model And Supabase Status

Supabase support is present and structured around real multi-restaurant tenancy. The migration set includes:

- `202606210001_secure_multi_tenant_rls.sql`
- `202606210002_restaurant_ops_backbone.sql`
- `202606220001_security_tenant_integrity.sql`
- `20260622053735_email_scaffolding.sql`
- `20260623001301_setup_persistence_observability.sql`
- `20260625212050_operational_constraints.sql`
- `20260627053512_edge_function_firewall.sql`
- `20260712121557_stabilize_order_workflow.sql`
- `20260713100023_harden_workflow_authority.sql`
- `20260713103021_atomic_setup_and_operational_signals.sql`
- `20260714035118_enforce_approval_quantity_bounds.sql`
- `20260714040255_enforce_positive_operational_quantities.sql`
- `20260714183310_secure_operational_workflows.sql`
- `20260714183313_bound_resources_and_staging_identity.sql`
- `20260715164427_close_workspace_allocation_churn.sql`
- `20260715164843_harden_profile_ai_and_order_boundaries.sql`
- `20260716204112_reinforce_tenant_isolation.sql`
- `20260718010000_outreach_agent.sql` (non-tenant, service-only outreach inventory)
- `20260719062148_gmail_backend_oauth_delivery.sql`
- `20260719062921_add_operator_locale_preference.sql`
- `20260719214822_supplier_recipient_management.sql`

Important Supabase concepts already modeled:

- `restaurants`
- `restaurant_memberships`
- `inventory_items`
- `menu_item_ingredients`
- `purchase_recommendations`
- `supplier_orders`
- `insights`
- `pos_integrations`
- `sales_imports`
- `supplier_items`
- `purchase_orders`
- `ai_insights`
- `audit_logs`
- `restaurant_email_connections`
- `supplier_recipients`
- `setup_attachments`

The Gmail migration also creates backend-only OAuth, credential, and delivery records in the private schema. PKCE verifiers and refresh credentials are stored through Supabase Vault; Expo can read only safe connection metadata.

The intended tenant model is strong: restaurant-owned data is scoped by `restaurant_id`, authenticated users must have active membership, and role checks distinguish owner/admin/manager/staff behavior.

Security posture in code:

- Expo client uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- No `service_role` key belongs in the client.
- Demo seed/reset paths are local-only when Supabase is configured.
- Audit logging does not allow client-forged `actor_user_id`.
- Provider tokens, POS secrets, OAuth client secrets, supplier credentials, and OpenAI keys are kept out of client-readable tables and Expo env vars. Gmail refresh credentials live in Supabase Vault and Gmail access tokens remain ephemeral in Edge Function memory.
- Static checks scan for broad RLS, anon grants, client secrets, destructive tenant operations, and unsafe token columns.
- Setup, inventory counts, recipe edits, and signal refreshes route through the authenticated `operational-workflows` Edge Function. Service-only RPCs recheck the actor, planning revision, and complete signal set before commit.
- Generated recommendations and insights carry `generation_source` and `planning_revision`; stale generated guidance is hidden while signal state is pending.
- Raw authenticated recommendation/insight replacement RPCs are revoked.
- Supplier notes are limited to 2,000 characters and derived order messages to 64 KiB at client, service, and database boundaries.
- Restaurant creation is limited to five active owner workspaces per user under a per-user advisory lock.
- Hosted mutation scripts require an exact HTTPS project reference and database-only staging marker before any fixture password or service key is transmitted.
- Operational screens reject late responses and render tenant data only when its recorded restaurant ID matches the active workspace.

## Edge Functions And Server-Side Workflow Status

Supabase Edge Functions have distinct implementation status:

- `sync-pos-sales`
- `generate-ai-insights`
- `link-gmail`
- `gmail-oauth-callback`
- `send-supplier-email`
- `operational-workflows`
- shared helper: `supabase/functions/_shared/mise.ts`

The restaurant functions enforce tenant and role boundaries, bounded input, sanitized metadata, audit/security events, and reservation-firewall controls. `operational-workflows` performs deterministic server-owned planning. `link-gmail`, `gmail-oauth-callback`, and `send-supplier-email` implement Google authorization-code OAuth, one-time state, S256 PKCE, least-privilege `gmail.send`, Vault-backed refresh credentials, token refresh/revocation, idempotent delivery claims, ambiguous-outcome review, and atomic sent-state updates after provider acceptance. Live Gmail is still disabled unless `GMAIL_SEND_ENABLED=true` is deliberately configured after consent and test-account approval. `sync-pos-sales` and `generate-ai-insights` authenticate, validate, reserve, recheck live restaurant roles, and audit the attempt before returning a terminal `blocked` event and an explicit `501`/`503` unavailable response. They make no provider call and create no queued import or placeholder insight.

Three separately classified, non-tenant outreach endpoints also exist: `outreach-agent`, `outreach-webhook`, and `outreach-unsubscribe`. App users have no access to their seven data tables or three service RPCs. Static and catalog tests require operator-secret, provider-signature, or opaque-capability authorization before service credentials are loaded. They were not deployed or given Resend/OpenAI credentials by the tenant-isolation work.

This is appropriate for demo/private-beta hardening. The Gmail integration layer is implemented but not live-approved; POS and model integrations remain fail-closed, unavailable boundaries.

## Demo Data Status

The local demo flow is intentionally separate from hosted Supabase data. It supports a deterministic, replaceable sample dataset:

- Generic sample restaurant identity.
- Full-service sample operating profile.
- 52 weeks of weekly sales history.
- Current-day POS activity.
- Inventory items.
- Recipe baselines.
- Suppliers and supplier recipients.
- Supplier drafts.
- POS connection state.
- Operational insights and readiness summaries.

This makes the app demoable without risking hosted tenant data.

The replacement boundary is `services/demo/`: `demoDataset.ts` owns the sample identity and `replaceableDemoData.ts` owns the fixture rows. `services/demoData.ts` is only a compatibility export. Product screens, application services, and Supabase repositories do not embed the sample restaurant identity, so a new demo can be installed without changing public behavior or backend contracts.

## Verification Status

Historical local and hosted closure run on July 18, 2026:

Commands:

```bash
npm run typecheck
npm test
npm audit --audit-level=high
npm run doctor
npm run security:backend
npm run design:static
npm run supabase:test
npx supabase db advisors --local --type security
npx expo export --platform web --output-dir /private/tmp/mise-web-export
npm run qa:routes
npm run qa:interactions
```

Historical July 18 result: passed for the migration and application set that existed at that time.

That run predates `20260719062148_gmail_backend_oauth_delivery.sql`, `20260719062921_add_operator_locale_preference.sql`, and `20260719214822_supplier_recipient_management.sql`.

Current production-candidate code-level evidence:

- TypeScript passed and the full test suite passed 156/156.
- Dependency audit found zero vulnerabilities; Expo Doctor passed 21/21 checks.
- Backend security, static security, static design, and frozen Deno Edge Function checks passed.
- Production web export and HTTP smoke passed; the core interaction suite passed across 15 routes at 390×844 with zero horizontal overflow, and a separate 320×844 layout pass also had zero overflow.
- The iOS metadata/icon/splash prerequisites were validated, but the TestFlight gate stopped because full Xcode and `simctl` are unavailable on this machine.

Docker is unavailable, so the latest additive migration chain has not yet run through `npm run supabase:test`; the combined private-beta and fresh hosted-staging closure must be rerun before promotion. No live Google OAuth exchange or real supplier email has been attempted.

Historical July 18 results:

- The unit, security, learning, and client-tenant regression suite passes.
- The official Docker-backed Supabase gate performed a clean reset, replayed the then-current additive migration chain, and passed 325/325 pgTAP assertions.
- Exact 25-public/4-private table inventories are catalog-asserted. Across all 15 operational tenant tables, a trusted structurally valid INSERT/UPDATE/DELETE control affects its fixture while the same cross-tenant manager probe affects zero rows; workflow tables remain RPC-only for clients. The seven non-tenant outreach tables have no app-user grants or policies and exactly service-role CRUD.
- The local 20-session workspace race accepts exactly five creations, rejects 15, and retains five immutable lifetime allocations.
- Supabase local security advisors report no issues.
- Dependency audit reports zero known vulnerabilities.
- Expo Doctor and Expo dependency compatibility checks pass on the pinned SDK 56 dependency set.
- The official CircleCI CLI validates the config; the pinned browser-tools orb installs Chrome before both normal interaction QA and the protected hosted client-race gate.
- Production web export passes.
- HTTP route smoke passes for 8/8 public routes.
- The interaction gate first passes 12/12 routes at 390×844 with zero horizontal overflow and no runtime exceptions.
- Rendered core interaction QA passes: demo initialization, inventory-count persistence, invalid order quantity rejection, approval persistence across reload, undo/re-approval, supplier draft creation, mark-sent history, recipe-baseline persistence, Insights refresh/filtering, demo POS switching, demo reset/recovery, sign-out, required setup validation, guided setup completion, and return to Today.
- The hosted gate passed without skips using locally loaded, gitignored staging values. No secret entered Expo, Chrome, QA subprocesses, source control, or the report.
- Complete A/B fixtures plus an independently authorized Tenant C proved cross-tenant SELECT/INSERT/UPDATE/DELETE denial across all 15 operational tables while preserving legitimate same-tenant behavior.
- The existing JWT lost Data API and Edge access immediately after its membership was disabled; guarded owner/admin behavior then restored the non-owner membership.
- Every tenant service-role operational RPC rejected a forged actor/tenant binding, and all five tenant Edge Functions rejected a foreign `restaurant_id`.
- Rendered delayed-response/mutation races passed across Today, Inventory, detail screens, Insights, Settings, and Orders.
- The 20-request POS race accepted exactly 8 requests, returned 429 for 12, and produced audit events only for accepted requests.
- The combined closure command fails closed when hosted credentials are absent.

The current automated test suite covers:

- Inventory outlooks.
- Recommendation generation and suppression.
- Recommendation approve/dismiss/undo behavior.
- Supplier draft generation.
- Recipe baseline behavior.
- Setup readiness and setup persistence preview.
- Replaceable local demo data.
- Conditional analytics gating.
- Gmail OAuth URL/state/PKCE contracts, partial-scope rejection, refresh behavior, bounded MIME generation, provider-failure classification, Vault-only credential storage, tenant/role denial, and idempotent delivery state using mocks/static assertions.
- POS adapter contracts.
- Tenant access helpers.
- Production demo credential hiding.
- RLS migration shape.
- Audit-log actor safety.
- Email token safety.
- Setup attachment metadata-only safety.
- Supabase demo seed/reset denial.
- Edge Function validation/firewall expectations.
- Direct detail route fallback states.
- Telemetry secret redaction.
- Restaurant-specific rolling historical learning, stale/anomalous decision rejection, and unit-compatible operator-memory bounds.
- Inventory-health reconciliation and empty-inventory percentage behavior.
- Operating-date boundaries, non-finite/negative anomaly clamping, recipe-unit compatibility, ceil-safe reorder rounding, equal-timestamp suppression, replay-safe recommendation rebuilds, and tenant-safe supplier grouping.
- Source-derived Today task identity, deduplication, role tiers, completion projection, and restaurant-timezone timing.
- English, Spanish, and Simplified Chinese/Mandarin route coverage, locale resolution, interpolation, localized number/currency/date formatting, relative due-time labels, validation, errors, and accessibility copy.
- Operator-locale identity isolation and staff/cross-tenant order-RPC denial pgTAP suites.
- Atomic setup, inventory, recipe, and operational-signal workflows.
- Active-workspace response generations, state provenance, and stale mutation continuation guards.

## iOS/TestFlight Status

iOS identity is configured:

- App name: Mise.
- Bundle ID: `com.mise.mobile`.
- Version: `0.1.0`.
- iOS build number: `2`.
- App icon: `assets/app-icon.png`.
- Splash image: `assets/splash-icon.png`, configured through the supported `expo-splash-screen` plugin.
- EAS profiles: development, preview, production.

The current Mac validates the app icon, splash, favicon, bundle identifier, and build number, but `qa:ios-prereq` fails because full Xcode is not selected and `simctl` is unavailable. Internal TestFlight is within reach from a code/config perspective, but still requires:

- Apple Developer account access.
- App Store Connect app setup.
- EAS login and credential flow.
- Support URL.
- Privacy policy URL.
- Apple privacy questionnaire.
- Account deletion path or documented deletion process.
- Real device QA on iPhone.
- Production/staging env vars set through EAS secrets.

Recommended command before any iOS build:

```bash
npm run ios:testflight:check
```

## Current Readiness Assessment

Local demo: ready.

Demo data walkthrough: ready.

Internal stakeholder demo: ready, assuming manual visual QA on the target device.

Internal TestFlight build: close, pending Apple/EAS credential work and real-device validation.

Private beta with real restaurant accounts: partially ready. The architecture and migrations are prepared, but the complete July 19 migration chain must pass Docker-backed and hosted-staging tenant checks before inviting real restaurants. Gmail must remain disabled unless its separate live-provider checklist is approved.

Paid public App Store product: not ready yet.

## Remaining Work Before Real Private Beta

Highest-priority next steps:

1. Apply the complete migration chain, including the Gmail and locale migrations, to a disposable hosted Supabase staging project.
2. Load `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_ANON_KEY`, `SUPABASE_STAGING_SECRET_KEY`, `MISE_STAGING_MARKER`, and `MISE_STAGING_SEED_PASSWORD` from a trusted local secret store.
3. Run `npm run verify:private-beta-security:hosted`; its trusted Node bootstrap creates the fixture Auth users and rerunnable tenant data before the hosted proofs.
4. Keep the local database gate green before promotion:

```bash
npm run supabase:test
```

5. Run `npm run verify:private-beta-security` and require both local and hosted phases with no skips.
6. Complete real-device iOS QA.
7. Confirm EAS/Apple build and TestFlight upload path.
8. Keep `GMAIL_SEND_ENABLED` unset/false until an approved Google OAuth test user, consent configuration, Workspace policy, and designated supplier recipient are available; then verify connect, refresh, revoke, send, duplicate prevention, and ambiguous-delivery review in staging.

## Remaining Work Before Paid Public Launch

The major gaps are not basic app structure anymore; they are production operations:

- Hosted staging proof and production Supabase project setup.
- Google Cloud OAuth consent configuration/verification and approved live testing of the implemented Vault-backed Gmail flow.
- Deliberate Gmail send enablement only after live connect, refresh, revoke, delivery, duplicate-prevention, and failure-recovery acceptance testing.
- POS provider adapters implemented server-side for the first live provider.
- Production Sentry/PostHog or equivalent monitoring.
- Privacy policy and support URLs.
- In-app account deletion or account deletion request flow.
- App Store screenshots and metadata.
- External TestFlight review.
- Load/performance pass with real restaurant-sized datasets.
- Backup/restore and incident-response process for Supabase.
- Billing/subscription system if charging customers.

## Recommended Positioning Right Now

Mise should be described as:

> A demo-ready and private-beta-oriented restaurant operations app with a secure multi-tenant Supabase foundation, authoritative operational tasks, inventory prediction, recipe baselines, supplier order drafts, observed trends, and an implemented but default-off Gmail delivery backend. Live POS, customer Gmail enablement, and paid production launch remain unverified production capabilities.

That is the honest, useful status: the product is no longer just a UI prototype, but it still needs staging proof and production operations before real paid customers rely on it.
