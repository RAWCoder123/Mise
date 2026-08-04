# App Store Readiness Checklist

Last updated: August 4, 2026

Classification guidance uses evidence, not polish. Current overall status: **not yet beta-ready for paid public launch**; **controlled pilot-ready** only after the latest migration chain passes Docker/hosted security gates.

Operator-facing StatusNotice localization and hub load telemetry now cover Today, Orders, Inventory, Insights, Settings hubs (including POS connect/import). Remaining App Store blockers are mostly external (Docker/hosted security re-proof, privacy/support URLs, Apple Developer / TestFlight, live POS/Gmail credentials).

| Item | Status | Notes |
| --- | --- | --- |
| Bundle ID `com.mise.mobile` | complete | Configured in `app.json` |
| App icon / splash | complete | Assets present; validated by `qa:ios-prereq` when Xcode is available |
| Version / build number | complete | `0.1.0` / iOS build `2` |
| Encryption export compliance flag | complete | `ITSAppUsesNonExemptEncryption = false` |
| In-app account deletion | tested (code) | Settings → Delete account; Edge `request-account-deletion` → `service_request_my_account_deletion`; sole-owned restaurants archive; memberships revoke; Auth delete; Edge rolls back on Auth failure; post-Auth-delete user-scoped security events finalize via `reserved_actor_user_id` / null-actor terminal rows (`20260802020000_*`); client requires exact `status=completed`, prefers that over secondary invoke errors, and always clears local session via `clearLocalSessionAfterAccountDeletion` even when remote `signOut` fails after Auth hard-delete; legacy authenticated request RPC revoked |
| Restaurant data export / portability | tested (code) | Settings → Export restaurant data (owner/admin); Edge `export-restaurant-data` with firewall 4/300s; demo local JSON path; invite tokens and secret-like POS settings redacted; POS sales capped to 90 days |
| Password reset | tested (code) | Login → Forgot password; `/reset-password` after recovery deep link; invalid/expired recovery callbacks surface localized login StatusNotice instead of silent bounce; local `supabase/config.toml` allowlists `mise://reset-password` and Expo schemes; hosted Supabase Auth UI must mirror the same redirect allowlist |
| Privacy policy URL | requires founder decision | Wire `EXPO_PUBLIC_PRIVACY_POLICY_URL` (HTTPS) once legal copy is published |
| Support URL | requires founder decision | Wire `EXPO_PUBLIC_SUPPORT_URL` (HTTPS) once support page exists |
| Apple privacy questionnaire | requires Apple Developer account action | App Store Connect |
| Terms of service link | requires legal copy | Not yet published |
| Demo / review instructions | complete | Local demo path documented in `docs/private-beta-demo-readiness.md` |
| No debug menus in production | complete | Diagnostics gated behind `__DEV__` |
| No embedded test credentials in production | complete | Demo credentials hidden when `EXPO_PUBLIC_APP_ENV=production` |
| Tenant isolation / RLS | blocked | pgTAP public/private allowlists and count/storage probes updated for July/Aug tables; `security-backend` now also pins final authenticated table DML grants (SELECT-only) for Edge-owned tables; Docker pgTAP + hosted staging must still re-run before pilot promotion |
| Live POS provider | blocked | Fail-closed until provider credentials and server adapter exist |
| Manual CSV POS ingest | tested (code) | Bounded Settings/setup CSV path; hosted ingest returns `skipped_incompatible_count` alongside unmapped sales; live providers remain fail-closed; pgTAP suite authored (`pos_consumption_skipped_incompatible.test.sql`) awaiting Docker execution |
| Recipe coverage / settings list | tested (code) | Coverage matches normalized POS menu keys; Settings → Recipes loads full mapped list; incompatible recipe/inventory units surface as a distinct repair path (Today/Settings/POS/Recipes); Save aligns recipe unit to inventory; count drafts parse locale decimals |
| Team roster / role management | tested (code) | Settings → Team; list RPCs remain authenticated; add/invite/update/remove Edge-routed via service RPCs; create restaurant + invite claim Edge-routed via user-scoped `account-onboarding`; residual authenticated DML grants on `restaurant_memberships` and `users` revoked (SELECT remains); demo roster seeded |
| Inventory count role split | tested (code) | Staff may draft/submit multi-item counts; manager+ approve ledger writes |
| Staff waste recording | tested (code) | Staff+ may record spoilage to the ledger with optional storage-station attribution; planning snapshot + signal commit allow staff for waste side effects; Edge audit allowlists staff-only action names; count/par edits stay manager+; Inventory list + staff detail elevate the waste path; pgTAP suite authored (`waste_station_attribution.test.sql`) awaiting Docker execution |
| Post-setup inventory item create | tested (code) | Manager+ Add item flow; service-owned create + opening ledger movement |
| Setup inventory quantity ledger | tested (code) | Edge `save_setup` → `service_save_restaurant_setup`; opening/`manual_count` movements; identical-quantity replay stays idempotent; legacy authenticated setup/audit RPCs revoked; demo path mirrors |
| Storage location list purity | tested (code) | Inventory station reads use `list_restaurant_storage_locations`; Main seeding stays on write/create paths; legacy ensure+list authenticated execute revoked |
| Manager inventory corrections | tested (code) | Single-item quantity edits ledger `manager_correction`; count sessions keep `manual_count`; hosted direct inventory updates disabled |
| Purchase approve / dismiss / draft / mark-sent | tested (code) | Edge-routed through `operational-workflows` with service-owned RPCs; legacy authenticated RPCs revoked |
| Manual pending recommendation create | tested (code) | Inventory “add to order” uses Edge `create_pending_purchase_recommendation`; legacy authenticated create RPC revoked |
| Supplier recipient upsert | tested (code) | Settings → Suppliers Edge-routed via `upsert_supplier_recipient`; service-owned RPC; legacy authenticated upsert revoked; staff remain read-only |
| Supplier receive put-away stations | tested (code) | Orders receive chooses Main/Walk-in put-away; service RPC + private put-away helper; domain/demo/UI covered; client fails closed with RetryNotice when storage stations cannot load (no silent Main fallback); pgTAP suite authored (`receive_supplier_order_putaway.test.sql`) awaiting Docker execution |
| Completed-order receive summary | tested (code) | Completed `/orders/[id]` shows ordered-versus-received ledger; client fails closed with RetryNotice when summary load fails (no silent empty-ledger fallback) |
| Inventory detail secondary loads | tested (code) | `/inventory/[id]` movements, storage stations, and station balances fail closed with RetryNotice + telemetry; waste/transfer gated when stations cannot load |
| Restaurant / operator profile mutations | tested (code) | `update_restaurant_profile`, `update_my_profile`, and locale writes Edge-routed via service RPCs; legacy authenticated mutation RPCs revoked; locale reads stay identity-free |
| Live Gmail send | requires external credentials | Implemented; keep `GMAIL_SEND_ENABLED=false` until approved test |
| Real-device iPhone QA | requires Apple Developer account action | Needs physical device / TestFlight |
| Crash reporting | requires founder decision | Optional public Sentry DSN |
| Product analytics | requires founder decision | Optional public PostHog key/host |
| EAS / TestFlight upload | requires Apple Developer account action | See `docs/testflight-readiness.md` |

## Apple App Store Review Guidelines cross-check (reviewed 2026-08-04)

Source: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

| Guideline | Mise status | Evidence / gap |
| --- | --- | --- |
| 2.1 App Completeness — final binaries, working URLs, on-device QA, demo account or demo mode | partial | Local demo mode exists; privacy/support HTTPS URLs and physical-device / TestFlight proof still required before submission |
| 2.3 Accurate metadata — description/screenshots match core experience | requires founder decision | Screenshot-ready screens exist in-app; ASC metadata not authored here |
| 5.1.1(i) Privacy policy link in ASC + in-app | blocked | Needs published HTTPS policy + `EXPO_PUBLIC_PRIVACY_POLICY_URL` |
| 5.1.1(v) Account creation ⇒ in-app account deletion | tested (code) | Settings → Delete account; Edge + service RPC path; still needs hosted Auth re-proof |
| 5.1.2 Data use / third-party sharing disclosure | requires founder decision | Optional Sentry/PostHog; disclose before enabling in production builds |
| Login for App Review — demo account or built-in demo mode | complete (demo mode) | Built-in local demo path documented; confirm Review Notes when submitting |

## Evidence still required before raising classification

1. `npm run verify:private-beta-security` with Docker and staging credentials, no skips.
2. Published privacy and support URLs configured in EAS secrets.
3. TestFlight install on a physical iPhone for core demo and hosted pilot workflows.
4. Founder decision on first live POS provider and Gmail enablement.
