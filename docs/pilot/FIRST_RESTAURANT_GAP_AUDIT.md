# First restaurant operating loop — gap audit

Date: 2026-08-14  
Branch: `pilot/first-restaurant-operating-loop`  
Baseline: `origin/main` at `e3d9f3472ecd90fa0a8392fb9a71c5cb5ff1d1ec`

## Status legend

- `READY` — the local product path is implemented and has direct automated evidence.
- `PARTIAL` — useful implementation exists, but the end-to-end contract is incomplete.
- `MISSING` — the required stage has no usable product path.
- `EXTERNAL` — code exists, but provider or hosted evidence needs credentials or infrastructure outside this repository.
- `UNSAFE` — the current path could create misleading operational state or an inadequately reviewed side effect.

## Executive verdict

Mise already contains most of the component workflows for a controlled operating loop: guarded Square and Gmail OAuth, idempotent Square sale identity, inventory count sessions, deterministic recipe depletion, recommendation and draft workflows, provider-verified Gmail completion, delivery receipt projection, and append-only activity. This milestone slice adds a machine-readable readiness contract, truthful Square import counts with replay coverage, and an explicit supplier delivery-envelope review whose approval is enforced separately from send execution. It is still not safe to call the loop pilot-ready. Inventory consumption is now anchored to verified count time (MISE-001): count freshness and depletion windows come from `inventory_events (event_type = 'count')` rather than `inventory_items.last_updated`. The principal remaining gaps are that live Square catalog identity is not connected to recipe consumption, and recommendation approval does not yet fail closed on the readiness contract.

## End-to-end matrix

| Stage | Current path | Status | Gap | Required work |
| --- | --- | --- | --- | --- |
| Authoritative baseline | PR #127 merged to `main`; reference evidence under `docs/design/` | READY | None for branch start | Preserve the reference UI and branch from current `main` |
| Restaurant workspace | `MiseSessionContext`, memberships, `restaurants`, tenant helpers | READY | Hosted pilot account not provisioned in this run | Use the existing invite-only provisioning path |
| Square OAuth | `app/settings/pos.tsx` → `link-square` → `square-oauth-callback` → Vault-backed credentials | EXTERNAL | No Square Sandbox credentials or callback proof in this run | Run authorized sandbox OAuth; retain owner/admin role gate, state, PKCE, and private token storage |
| Square locations | OAuth callback → `service_complete_square_oauth` → `pos_locations` | PARTIAL | UI does not expose location selection; sync uses all active locations from the credential | Add explicit location authorization/selection if the first merchant has more than one operational location |
| Square sync | `sync-pos-sales` → `_shared/square` → `service_apply_square_sync_result` → `operational-workflows.refresh_signals` | PARTIAL | Truthful processed counts are now persisted; signal refresh failure is still swallowed after sales commit | Persist an explicit planning-stale/refresh-failed state |
| Sales persistence | `pos_sales` unique `(restaurant_id, source_pos, source_record_id)`; Square order-line IDs are preserved | READY | Replay/overlap pgTAP proof exists but the full database suite was not executable in this run | Run `supabase:test` against the exact candidate migration chain |
| Catalog mapping | Square catalog → `menu_items` + draft `pos_catalog_item_mappings` | UNSAFE | New menu items are matched/created by normalized name, mapping stays draft, deleted/inactive items are not reconciled, and no operator UI resolves draft mappings | Preserve provider item/variation identity on sales and add a minimal mapping review UI; never use draft mappings for planning |
| Inventory baseline | `inventory/count` → count-session RPCs → canonical inventory ledger → projected on-hand | READY | Hosted database proof was not run in this session | Run pgTAP and a controlled opening count with real items |
| Inventory freshness | `inventoryCountAuthority` derives freshness and depletion windows from verified `inventory_events` counts; forecasts, automation, findings, and Home consume it | READY | Hosted database proof of the updated planning snapshot was not run in this session | Run `supabase:test` and a controlled midday count against real items |
| Recipe mapping | `menu_item_ingredients`; deterministic name-normalized sale-to-ingredient use; unit compatibility checks | PARTIAL | The screen-facing recipe model is name-based and does not consume verified `pos_catalog_item_mappings`; mapping coverage is not an ordering gate | Join verified provider identity to menu/recipe identity and expose missing mappings |
| Recipe consumption | `calculateOperationalSignals` and `buildInventoryPrediction` | PARTIAL | Depletion is now anchored to verified count time; incomplete recipes still do not block recommendation creation | Add planning readiness blockers at recommendation approval |
| Forecast / outlook | `operationalSignals`, recalculation cycles, run ledger | PARTIAL | Open/mid/close cycles currently run the same recomputation; scheduled execution still depends on opening Home | Differentiate close reconciliation and add an authorized machine-runner before unattended operation |
| Pilot readiness | `buildPilotReadiness` → `fetchPilotReadiness` → Settings / POS status | READY | Exact blockers cover POS history/freshness, physical counts/canonical units, sales-weighted recipe coverage, supplier/cost routing, recipients, and Gmail; approval paths do not consume it yet | Enforce the same contract in recommendation approval/drafting after temporal count anchoring |
| Recommendation | `service_commit_operational_signals`, `purchase_recommendations`, learning history | UNSAFE | Recommendation can still be created from stale/unverified inventory and incomplete recipe coverage; evidence is mainly a prose reason | Gate purchasing on pilot readiness and persist structured provenance inputs |
| Recommendation suppression | handled recommendation + newer verified count evidence | READY | Suppression is released only by a count strictly newer than the decision, and stays closed without evidence | Keep the fail-closed default when count evidence is unavailable |
| Supplier draft | approve RPC groups recommendations into one tenant/supplier draft and rebuilds idempotently | READY | Draft has no structured order-line table; totals cannot be authoritative when costs are incomplete | Keep totals absent unless every line has authoritative cost; consider durable structured lines before scaling |
| Human recommendation approval | `approve_purchase_recommendation`; owner/admin/manager; quantity bounded | READY | Approval freshness is not revalidated server-side | Re-evaluate current planning/readiness evidence inside the approval boundary |
| Supplier recipient | `supplier_recipients` guarded RPC, directory UI, and final delivery-envelope review | PARTIAL | Order detail displays exact sender, recipient, and subject; normalized supplier-name matching is consistent across review, demo, approval, and provider claim, but identity is still name-based | Move to durable supplier identity while preserving exact tenant/supplier binding |
| Gmail OAuth | `link-gmail` → callback → Vault-backed credential | EXTERNAL | Google OAuth credentials and sender proof were not available in this run | Use a Mise-controlled test Gmail account in authorized staging |
| Gmail live-send gate | `GMAIL_SEND_ENABLED`, system and restaurant provider controls | READY | Environment remains intentionally disabled until explicitly configured | Keep fail-closed and document activation ownership |
| Send approval | prepared `mise_action` → visible From/To/Subject review → `approve_supplier_send_envelope` → `send-supplier-email` | READY | List and Home no longer send; approval stores the exact envelope and the row-locked provider claim rejects stale or missing approval without recording a send failure; provider proof remains external | Run the controlled destination proof and preserve the approval/send separation |
| Duplicate-send protection | one delivery claim per tenant/order, stable RFC Message-ID, in-progress and stale-claim handling | READY | Hosted provider concurrency proof not run | Execute double-tap, retry, timeout, and slow-provider staging cases |
| Ambiguous Gmail result | delivery becomes `unknown`; action becomes `unverified`; later claims return review-required | READY | No operator resolution workflow exists beyond blocking resend | Add a reviewed resolution action before any future resend capability |
| Send verification / final state | provider message ID → atomic delivery/order/recommendation update | READY | External send not run | Prove with controlled sender and recipient; redact IDs in evidence |
| Delivery outcome | `record_supplier_delivery` → delivery rows + inventory receipt events + order completed | READY | Physical receipt was not proven against a real order | Run one controlled receipt and discrepancy case |
| Activity trail | triggers on sales imports, recommendations, orders, inventory events, outcomes | PARTIAL | Square import activity now receives the truthful processed count; sync-to-recompute causality is not represented as one stable sequence | Carry a correlation/sequence through sync and planning |
| Home | operating brief, activity, approvals, data freshness | PARTIAL | Freshness now reports verified count evidence only and goes incomplete without it; explicit Gmail readiness is still missing | Consume the pilot readiness model; warn only on material blockers |
| Today | authoritative projections for POS, counts, recommendations, drafts, and shared tasks | PARTIAL | Connected POS is treated complete even when last sync is stale; Gmail/recipient readiness is indirect | Add readiness-derived reconnect/mapping/recipient work |
| Ask Mise | deterministic shared restaurant data via `fetchAskMiseAnswer` | PARTIAL | It cannot yet answer verified recipient/delivery ambiguity or mapping-readiness questions | Add grounded deterministic answers only after readiness data is authoritative |
| Tenant isolation | RLS, service RPC checks, `tenant_isolation.test.sql`, role-specific tests | READY | Latest chain not executed through Docker in this run | Run full migration + pgTAP chain before staging claim |
| Role enforcement | owner/admin/manager/staff gates in Edge, RPCs, and UI | READY | Role matrix was not previously centralized for the pilot | Maintain `PILOT_ROLE_MATRIX.md` and add tests for new readiness/approval paths |
| Observability | bounded Edge security events, audit logs, activity, telemetry redaction | PARTIAL | Required milestone event vocabulary is split across security telemetry, audit, and activity; refresh failures are easy to miss | Normalize pilot-stage telemetry without storing provider payloads or message bodies |
| Future learning | approved quantities, recommendation decisions, outcomes, memories | PARTIAL | Receive + post-count `action_outcomes` link predicted/ordered/received/counted variance; established chronic post-receive undercounts now pad recommendation quantities via bounded `purchaseLoopCountHistory` advisory (≤1.25, absolute bounds) | Land/rebase open stacks; keep authority gates closed; optional composition with short-ship / 004B multipliers when those PRs merge |

## Failure-matrix coverage summary

| Area | Existing evidence | Remaining evidence |
| --- | --- | --- |
| Square | OAuth/state/PKCE helpers, secret boundary, provider kill switches, normalized rows, role gates | Executed duplicate and overlapping database sync; invalid location; partial pagination; refresh failure after sales commit; catalog deletion |
| Inventory | Count roles/states, canonical units, append-only ledger, replay/conflict, tenant scope, count freshness distinct from policy/receipt updates, midday temporal anchoring, count-instant boundary | Deleted item during an open count in hosted DB; hosted proof of the updated planning snapshot |
| Recipe | Unit compatibility, missing mapping visibility, deterministic depletion | Verified provider-ID mapping; incomplete recipe confidence/blocking; disabled menu item behavior |
| Recommendation | Tenant/supplier/unit/quantity/cost/staleness automation evaluator; suppression history | Enforce those blockers on manual purchasing progress; structured provenance; count-evidence freshness |
| Order | Supplier grouping, quantity bounds, replay-safe approval, draft reuse | Mixed-supplier and cost completeness as server-side draft invariants; structured order lines |
| Gmail | OAuth, role/tenant checks, recipient validation, live gate, claim/idempotency, ambiguous and finalize-failure handling | Controlled live OAuth/send; explicit operator resolution after unknown; recipient-visible review |
| Security | Static backend checks, role tests, tenant pgTAP source | Execute full pgTAP chain and hosted cross-tenant checks at the exact candidate commit |

## Highest-priority implementation order

1. ~~Separate verified inventory-count freshness from generic item update time and anchor depletion to count time.~~ Done in MISE-001.
2. Connect provider catalog/variation identity to verified menu mapping and recipe consumption.
3. Enforce the readiness contract at recommendation approval and draft generation with structured provenance.
4. Persist explicit signal-refresh failure state and sync-to-recompute correlation.
5. Prove the controlled loop in staging and record only redacted evidence.
