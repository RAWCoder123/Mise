# Mise Tenant-Isolation Architecture

Last updated: July 18, 2026

## Canonical invariant

Every hosted request must satisfy:

`authenticated user -> active restaurant membership -> permitted role -> restaurant-scoped resource`

`public.restaurant_memberships` is the only application authorization source. `public.users.restaurant_id` and `public.users.role` are legacy profile metadata and never authorize a row, RPC, or Edge Function. A user with active memberships in multiple restaurants receives the union of those tenants. Disabling one membership removes only that tenant.

## Capability map

| Role | Read tenant operations | Mutate operations | Restaurant profile/integrations | Membership administration |
|---|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Add admin/manager/staff; change non-owners; promote an active non-owner to owner |
| Admin | Yes | Yes | Yes | Add/change/remove manager and staff only |
| Manager | Yes | Yes, through approved workflows | No restaurant administration | No |
| Staff | Yes | No | No | No |

No user may create, change, disable, or remove their own membership. No client may demote, disable, or remove any owner. Exceptional owner removal is a trusted administrative procedure outside the Data API.

## Data API table matrix

All application tables have RLS enabled. Every tenant resource has a non-null `restaurant_id`. `anon` has no table privilege in `public` or `private`. `service_role` has explicit CRUD for trusted bootstrap/Edge use but no `TRUNCATE`, `TRIGGER`, or `REFERENCES`; it never enters Expo. Seven global Mise outreach tables are explicitly classified as non-tenant service-only data: app users receive no grant or policy on them.

| Object | Scope | Authenticated grant | Authority contract |
|---|---|---|---|
| `public.restaurants` | Tenant root (`id`) | SELECT | Active member reads; owner/admin profile updates use `update_restaurant_profile` |
| `public.users` | User (`id = auth.uid()`) | SELECT | Bounded display-name changes use `update_my_profile`; legacy role/restaurant fields are immutable to clients |
| `public.restaurant_memberships` | Tenant authorization | SELECT | Own rows plus owner/admin roster reads; all writes use guarded membership RPCs |
| `public.pos_sales` | Tenant | SELECT | Manager-owned setup/POS workflows write |
| `public.inventory_items` | Tenant | SELECT | Revision-checked operational workflow writes |
| `public.menu_item_ingredients` | Tenant | SELECT | Revision-checked recipe workflow writes; composite inventory FK |
| `public.purchase_recommendations` | Tenant | SELECT | Current/manual rows only; guarded recommendation/signal RPCs write; composite inventory/order FKs |
| `public.supplier_orders` | Tenant | SELECT | Draft/sent state-machine RPCs write |
| `public.insights` | Tenant | SELECT | Current/manual rows only; service signal workflow writes |
| `public.pos_integrations` | Tenant | SELECT/INSERT/UPDATE/DELETE | Owner/admin policy with `USING` and `WITH CHECK` where applicable |
| `public.sales_imports` | Tenant | SELECT/INSERT/UPDATE/DELETE | Owner/admin/manager policy; composite POS-integration FK |
| `public.supplier_items` | Tenant | SELECT/INSERT/UPDATE/DELETE | Owner/admin/manager policy |
| `public.purchase_orders` | Tenant | SELECT/INSERT/UPDATE/DELETE | Owner/admin/manager policy |
| `public.ai_insights` | Tenant | SELECT | Server-attested rules-engine RPC writes; client provenance writes denied |
| `public.audit_logs` | Tenant | SELECT | Owner/admin read; fixed-semantic or actor-rechecking service RPC writes |
| `public.restaurant_email_connections` | Tenant | SELECT/INSERT/UPDATE/DELETE | Owner/admin policy; tokens remain outside public tables |
| `public.supplier_recipients` | Tenant | SELECT/DELETE | Setup workflow owns bounded insert/update |
| `public.setup_attachments` | Tenant | SELECT | Setup workflow owns metadata-only writes |
| `private.edge_function_security_events` | Tenant/private | None | Reservation lifecycle; same-tenant composite reservation FK; one terminal event |
| `private.environment_identity` | Environment/private | None | Non-secret staging identity comparison only |
| `private.restaurant_signal_state` | Tenant/private | None | Planning/signal revisions and current/pending state |
| `private.restaurant_workspace_allocations` | User/private | None | Immutable lifetime workspace quota ledger |

The non-tenant service-only inventory is also exact:

| Object | Scope | App-user grant | Authority contract |
|---|---|---|---|
| `public.outreach_campaigns` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_leads` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_enrollments` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_messages` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_suppressions` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_events` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |
| `public.outreach_agent_runs` | Global Mise operations | None | Forced RLS, no policies; service-role CRUD only |

There are no application views. Any future authenticated view must use `security_invoker=true` or remain ungranted. Default table, sequence, and function privileges are revoked so future objects fail closed until a migration grants them deliberately.

## Function authority matrix

### Authenticated public RPCs

| Functions | Contract |
|---|---|
| `create_restaurant_with_owner` | Auth-derived owner; advisory-locked five-workspace lifetime allocation |
| `add_restaurant_member`, `update_restaurant_member`, `remove_restaurant_member` | Live actor membership; self-mutation denied; owner/admin hierarchy enforced under tenant advisory lock |
| `update_my_profile` | Auth-derived user; name only, 1–120 characters |
| `update_restaurant_profile` | Active owner/admin; bounded allowlisted patch |
| `save_restaurant_setup`, `record_setup_completion_audit` | Active manager role; bounded atomic setup and fixed audit semantics |
| `fetch_planning_sales` | Active membership; bounded aggregate |
| `create_pending_purchase_recommendation`, `approve_purchase_recommendation`, `dismiss_purchase_recommendation`, `undo_purchase_recommendation_action` | Active manager role; guarded recommendation state machine |
| `update_supplier_order_draft`, `mark_supplier_order_sent` | Active manager role; guarded supplier-order state machine |

### Service-role public RPCs

| Functions | Contract |
|---|---|
| `reserve_edge_function_invocation`, `record_edge_function_security_event` | Actor/tenant/function reservation binding and exactly one terminal event |
| `service_record_edge_audit_log` | Same-transaction live manager-role recheck; bounded server-derived actor event |
| `service_fetch_operational_planning_snapshot` | Live actor/tenant recheck before snapshot |
| `service_mark_operational_signals_pending`, `service_commit_operational_signals` | Live actor and expected revision; complete signal-set transition |
| `service_update_inventory_and_signals`, `service_save_recipe_and_signals` | Live actor, tenant-owned IDs, optimistic revision, atomic signals |
| `service_create_rules_engine_ai_insight` | Live actor/tenant recheck and server-attested provenance |
| `service_claim_outreach_enrollment`, `service_release_stale_outreach_claims`, `service_unsubscribe_outreach` | Global outreach-only state; service-role execution only; no app-user execution grant |

`verify_staging_identity` is the only anonymous callable and compares a non-secret marker. Raw replacement functions, obsolete client-payload workflow functions, and trigger helpers have no Data API execution grant.

Private functions are not Data API endpoints. The final inventory is: `actor_has_restaurant_role`, `build_supplier_order_message`, `bump_recommendation_history_revision`, `bump_restaurant_planning_revision`, `commit_operational_signals`, `create_restaurant_with_owner`, `edge_function_policy`, `fetch_operational_planning_snapshot`, `guard_last_active_restaurant_owner`, `has_restaurant_role`, `is_restaurant_member`, `mark_operational_signals_pending`, `normalize_setup_completion_audit`, `restaurant_operational_profile_is_valid`, `service_create_rules_engine_ai_insight`, `service_record_edge_audit_log`, `service_save_recipe_and_signals`, `service_update_inventory_and_signals`, `signals_are_current`, `structured_ai_insight_output_is_valid`, `truncate_utf8`, and `update_restaurant_profile`. Every privileged function pins `search_path = ''`; pgTAP checks the final catalog rather than historical SQL text.

## Edge Function matrix

| Edge Function | Allowed roles | Trusted boundary |
|---|---|---|
| `operational-workflows` | Owner/admin/manager | Auth first; 64 KiB body; independent live role check; reservation; actor-bound revision RPC |
| `sync-pos-sales` | Owner/admin/manager | Auth first; bounded request; reservation; live membership; audited fail-closed `501`/`503`; no import row until a provider is enabled |
| `generate-ai-insights` | Owner/admin/manager | Auth first; reservation; live membership; audited fail-closed `501`/`503`; no placeholder insight or live model call |
| `link-gmail` | Owner/admin | Auth first; reservation; live membership; no OAuth token storage or live OAuth |
| `send-supplier-email` | Owner/admin/manager | Auth first; reservation; tenant-scoped reads; live sending disabled |
| `outreach-agent` | No app role | Non-tenant operator secret before body parsing or service-client creation; JWT gateway bypass is explicit |
| `outreach-webhook` | No app role | Bounded raw body; Resend/Svix signature verified before service-client creation; JWT gateway bypass is explicit |
| `outreach-unsubscribe` | No app role | Opaque UUID capability validated before service-client creation; GET confirmation precedes POST mutation |

Every accepted tenant reservation records exactly one `blocked`, `completed`, or `error` terminal event. Operational and audit service RPCs recheck the supplied actor against live membership, so disabling a membership takes effect for existing JWTs. The three outreach endpoints never receive Expo secrets or app-user table grants; this tenant pass did not deploy them or configure Resend/OpenAI credentials.

## Storage, Realtime, and client state

- Storage: zero buckets; uploads remain disabled for the pilot.
- Realtime: zero application tables in `supabase_realtime`; subscriptions remain disabled for the pilot.
- The client rejects late tenant responses using request generations and active-restaurant identity checks.
- Hosted sessions revalidate live memberships on authorization denial, app foreground, and every 10 seconds. When the active membership disappears, the client invalidates pending requests, clears the active restaurant, restaurant lists, membership/role state, POS state, and the persisted tenant snapshot before rehydrating any remaining authorized workspace.

## Local evidence

Observed July 18, 2026 after a clean migration replay:

- TypeScript: passed.
- Unit/source tests: 110/110 passed.
- Full Supabase migration reset: passed.
- pgTAP tenant/catalog suite: 325/325 passed.
- The final catalog matches an exact allowlist of 25 public and 4 private tables: 18 application tables plus 7 non-tenant service-only outreach tables. An unexpected table, view, grant, Realtime publication, or public Storage bucket fails verification.
- For each of the 15 operational tenant tables, a structurally valid trusted-fixture INSERT/UPDATE/DELETE control affects exactly one fixture row while the same rollback-only probe from an unrelated restaurant manager affects zero rows. Workflow tables remain RPC-only even for owners.
- Concurrent workspace allocation: 5 accepted, 15 rejected, 5 immutable allocations.
- npm audit: zero vulnerabilities.
- Supabase local security advisors: no issues found.
- Production web export, 8/8 route smoke, and 12/12 mobile layout checks: passed.

The hosted gate passed on July 18, 2026 without skips in a disposable project. It seeded complete A/B operational fixtures and a separately authorized Tenant C, denied cross-tenant SELECT/INSERT/UPDATE/DELETE across all 15 operational tables, and confirmed the authorized B/C observer still saw unchanged fixtures. It also passed same-tenant role controls, immediate membership-revocation checks using the existing JWT, forged-tenant requests against all five tenant Edge Functions, actor/tenant forgery probes against every tenant service-role operational RPC, rendered delayed A-to-B screen races, and the 20-request reservation test with exactly 8 accepted and 12 rate-limited responses. Tenant isolation is ready for a controlled pilot on this tested snapshot; the full combined gate must be rerun after relevant code, migration, Edge, or staging-configuration changes.
