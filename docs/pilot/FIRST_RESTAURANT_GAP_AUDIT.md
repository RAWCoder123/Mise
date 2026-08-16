# First restaurant operating loop — gap audit

Date: 2026-08-15
Branch: `pilot/first-loop-source-truth`
Baseline: `origin/main` at `312c6f13a7d9d405ddfcad6eb7260020c3f54bb1`

## Status legend

- `READY` — the local product path is implemented and has direct automated evidence.
- `PARTIAL` — useful implementation exists, but the end-to-end contract is incomplete.
- `MISSING` — the required stage has no usable product path.
- `EXTERNAL` — code exists, but provider or hosted evidence needs credentials or infrastructure outside this repository.
- `UNSAFE` — the current path could create misleading operational state or an inadequately reviewed side effect.

## Executive verdict

Mise now closes the source-truth gaps in the controlled operating loop: one selected Square location, provider item and variation identity, manager-reviewed catalog mappings, verified recipe-version chains, physical-count freshness, post-count depletion, structured recommendation provenance, and fail-closed revalidation through approval, draft preparation, and send authorization. It is still not safe to call the loop pilot-ready until signal-refresh failure state and end-to-end correlation are durable, the failure matrix and runbook evidence are complete, and the exact migration/function candidate is executed on configured hosted staging.

## End-to-end matrix

| Stage | Current path | Status | Gap | Required work |
| --- | --- | --- | --- | --- |
| Authoritative baseline | PR #127 merged to `main`; reference evidence under `docs/design/` | READY | None for branch start | Preserve the reference UI and branch from current `main` |
| Restaurant workspace | `MiseSessionContext`, memberships, `restaurants`, tenant helpers | READY | Hosted pilot account not provisioned in this run | Use the existing invite-only provisioning path |
| Square OAuth | `app/settings/pos.tsx` → `link-square` → `square-oauth-callback` → Vault-backed credentials | EXTERNAL | No Square Sandbox credentials or callback proof in this run | Run authorized sandbox OAuth; retain owner/admin role gate, state, PKCE, and private token storage |
| Square locations | OAuth callback → `pos_locations` → guarded manager selection | READY | Hosted multi-location proof remains external | Select exactly one controlled-pilot location and record hosted evidence |
| Square sync | `sync-pos-sales` → `_shared/square` → `service_apply_square_sync_result` → `operational-workflows.refresh_signals` | PARTIAL | Truthful processed counts are now persisted; signal refresh failure is still swallowed after sales commit | Persist an explicit planning-stale/refresh-failed state |
| Sales persistence | `pos_sales` unique `(restaurant_id, source_pos, source_record_id)`; Square order-line IDs are preserved | READY | Replay/overlap pgTAP proof exists but the full database suite was not executable in this run | Run `supabase:test` against the exact candidate migration chain |
| Catalog mapping | Square catalog → provider identity → guarded review → verified recipe version | READY | Deleted/inactive catalog reconciliation and hosted proof remain open | Run controlled catalog review on staging; draft/rejected mappings remain excluded |
| Inventory baseline | `inventory/count` → count-session RPCs → canonical inventory ledger → projected on-hand | READY | Hosted database proof was not run in this session | Run pgTAP and a controlled opening count with real items |
| Inventory freshness | Latest non-superseded count event `effective_at` | READY | Hosted pgTAP execution remains open | Prove stale, superseded, receipt-after-count, and policy-edit cases on staging |
| Recipe mapping | Verified provider identity → verified recipe version → verified canonical ingredient | READY | Manual/demo retain their legacy-compatible path by design | Keep name-only and draft live mappings excluded |
| Recipe consumption | `calculateOperationalSignals` with a count-time sales window | READY | Live provider proof remains external | Prove a controlled post-count Square sale on staging |
| Forecast / outlook | `operationalSignals`, recalculation cycles, run ledger | PARTIAL | Open/mid/close cycles currently run the same recomputation; scheduled execution still depends on opening Home | Differentiate close reconciliation and add an authorized machine-runner before unattended operation |
| Pilot readiness | `buildPilotReadiness` → `fetchPilotReadiness` → Settings / POS status | READY | Exact blockers cover POS history/freshness, physical counts/canonical units, sales-weighted recipe coverage, supplier/cost routing, recipients, and Gmail; approval paths do not consume it yet | Enforce the same contract in recommendation approval/drafting after temporal count anchoring |
| Recommendation | Structured confidence and bounded source evidence committed by the Edge workflow | READY | Exact hosted execution remains open | Regenerate legacy blocked rows after staging deployment |
| Recommendation suppression | handled recommendation + later `last_updated` comparison | PARTIAL | A non-count item update can unsuppress a handled recommendation | Compare against newer verified inventory evidence instead |
| Supplier draft | approve RPC groups recommendations into one tenant/supplier draft and rebuilds idempotently | READY | Draft has no structured order-line table; totals cannot be authoritative when costs are incomplete | Keep totals absent unless every line has authoritative cost; consider durable structured lines before scaling |
| Human recommendation approval | `approve_purchase_recommendation`; role, quantity, and provenance checked | READY | Hosted stale-approval pgTAP remains open | Execute stale count/revision rejection in staging |
| Supplier recipient | `supplier_recipients` guarded RPC, directory UI, and final delivery-envelope review | PARTIAL | Order detail displays exact sender, recipient, and subject; normalized supplier-name matching is consistent across review, demo, approval, and provider claim, but identity is still name-based | Move to durable supplier identity while preserving exact tenant/supplier binding |
| Gmail OAuth | `link-gmail` → callback → Vault-backed credential | EXTERNAL | Google OAuth credentials and sender proof were not available in this run | Use a Mise-controlled test Gmail account in authorized staging |
| Gmail live-send gate | `GMAIL_SEND_ENABLED`, system and restaurant provider controls | READY | Environment remains intentionally disabled until explicitly configured | Keep fail-closed and document activation ownership |
| Send approval | prepared `mise_action` → visible From/To/Subject review → `approve_supplier_send_envelope` → `send-supplier-email` | READY | List and Home no longer send; approval stores the exact envelope and the row-locked provider claim rejects stale or missing approval without recording a send failure; provider proof remains external | Run the controlled destination proof and preserve the approval/send separation |
| Duplicate-send protection | one delivery claim per tenant/order, stable RFC Message-ID, in-progress and stale-claim handling | READY | Hosted provider concurrency proof not run | Execute double-tap, retry, timeout, and slow-provider staging cases |
| Ambiguous Gmail result | delivery becomes `unknown`; action becomes `unverified`; later claims return review-required | READY | No operator resolution workflow exists beyond blocking resend | Add a reviewed resolution action before any future resend capability |
| Send verification / final state | provider message ID → atomic delivery/order/recommendation update | READY | External send not run | Prove with controlled sender and recipient; redact IDs in evidence |
| Delivery outcome | `record_supplier_delivery` → delivery rows + inventory receipt events + order completed | READY | Physical receipt was not proven against a real order | Run one controlled receipt and discrepancy case |
| Activity trail | triggers on sales imports, recommendations, orders, inventory events, outcomes | PARTIAL | Square import activity now receives the truthful processed count; sync-to-recompute causality is not represented as one stable sequence | Carry a correlation/sequence through sync and planning |
| Home | operating brief, activity, approvals, data freshness | PARTIAL | Freshness can claim currency from non-count updates and does not include explicit Gmail readiness | Consume the pilot readiness model; warn only on material blockers |
| Today | authoritative projections for POS, counts, recommendations, drafts, and shared tasks | PARTIAL | Connected POS is treated complete even when last sync is stale; Gmail/recipient readiness is indirect | Add readiness-derived reconnect/mapping/recipient work |
| Ask Mise | deterministic shared restaurant data via `fetchAskMiseAnswer` | PARTIAL | It cannot yet answer verified recipient/delivery ambiguity or mapping-readiness questions | Add grounded deterministic answers only after readiness data is authoritative |
| Tenant isolation | RLS, service RPC checks, `tenant_isolation.test.sql`, role-specific tests | READY | Latest chain not executed through Docker in this run | Run full migration + pgTAP chain before staging claim |
| Role enforcement | owner/admin/manager/staff gates in Edge, RPCs, and UI | READY | Role matrix was not previously centralized for the pilot | Maintain `PILOT_ROLE_MATRIX.md` and add tests for new readiness/approval paths |
| Observability | bounded Edge security events, audit logs, activity, telemetry redaction | PARTIAL | Required milestone event vocabulary is split across security telemetry, audit, and activity; refresh failures are easy to miss | Normalize pilot-stage telemetry without storing provider payloads or message bodies |
| Future learning | approved quantities, recommendation decisions, outcomes, memories | PARTIAL | No single outcome links predicted consumption, ordered quantity, received quantity, and later variance | Add outcome measurement after the authoritative loop is proven |

## Failure-matrix coverage summary

| Area | Existing evidence | Remaining evidence |
| --- | --- | --- |
| Square | OAuth/state/PKCE helpers, secret boundary, provider kill switches, normalized rows, role gates | Executed duplicate and overlapping database sync; invalid location; partial pagination; refresh failure after sales commit; catalog deletion |
| Inventory | Count roles/states, canonical units, append-only ledger, replay/conflict, tenant scope | Count freshness distinct from policy/receipt updates; midday temporal anchoring; deleted item during an open count in hosted DB |
| Recipe | Unit compatibility, missing mapping visibility, deterministic depletion | Verified provider-ID mapping; incomplete recipe confidence/blocking; disabled menu item behavior |
| Recommendation | Tenant/supplier/unit/quantity/cost/staleness automation evaluator; suppression history | Enforce those blockers on manual purchasing progress; structured provenance; count-evidence freshness |
| Order | Supplier grouping, quantity bounds, replay-safe approval, draft reuse | Mixed-supplier and cost completeness as server-side draft invariants; structured order lines |
| Gmail | OAuth, role/tenant checks, recipient validation, live gate, claim/idempotency, ambiguous and finalize-failure handling | Controlled live OAuth/send; explicit operator resolution after unknown; recipient-visible review |
| Security | Static backend checks, role tests, tenant pgTAP source | Execute full pgTAP chain and hosted cross-tenant checks at the exact candidate commit |

## Highest-priority implementation order

1. Persist explicit signal-refresh failure state and sync-to-recompute correlation.
2. Complete the failure matrix, role matrix, runbook, and exact-candidate evidence.
3. Deploy and prove the controlled loop in hosted staging with redacted evidence.
