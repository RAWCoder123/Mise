# Mise Security Remediation Report

Date: July 13, 2026  
Target: private-beta readiness  
Source findings: `docs/security-scan-report-2026-07-13.md`

## July 18 hosted tenant-isolation closure

The disposable hosted environment is now configured and the required local and hosted gates both pass without skipped checks. This section is the current closure position; the dated sections and finding tables below remain preserved as audit history of what was still pending at those earlier checkpoints.

Observed evidence on July 18, 2026:

- `npm run verify:private-beta-security:local`: passed end to end with 110/110 unit/security tests, zero npm vulnerabilities, a clean additive migration replay, 325/325 pgTAP assertions, five accepted and fifteen rejected concurrent workspace allocations, no local security-advisor issues, web export, 8/8 route smoke, and 12/12 mobile layouts.
- `npm run verify:private-beta-security:hosted`: passed without skips after trusted Auth Admin seeding in the disposable `Mise Staging Security` project.
- The rendered client suite held Tenant A requests and a mutation while switching to Tenant B across Today, Inventory, inventory detail, Insights, Settings, Orders, and order detail; Tenant A data never rendered or refreshed under Tenant B.
- The Data API suite denied unrelated-tenant SELECT/INSERT/UPDATE/DELETE across all 15 operational tables and preserved the independently observed Tenant B/C fixtures.
- Disabling a membership immediately removed Data API and Edge access for the same JWT. Self-mutation, owner mutation/removal, manager membership administration, direct profile-role writes, and direct workflow DML were denied.
- Every service-role operational RPC rejected a forged actor/tenant binding. All five tenant Edge Functions rejected a source-tenant-authorized caller supplying Tenant B.
- The Edge boundary rejected oversized and missing-length bodies before the reservation race; the hosted gateway returns 400 for chunked missing-length requests while the shared function parser returns 411 when reached. The subsequent race still accepted exactly 8 of 20 and returned 429 for 12, proving the rejected body did not consume a reservation.
- The deployed Edge authentication helper was corrected to validate the explicit bearer token with the trusted server verifier while all tenant reads and writes remain caller-scoped or actor-rechecked. All five tenant functions were redeployed with `verify_jwt=true`.
- Staging values remain in the mode-0600, gitignored `.mise-staging.env`; Expo export did not load that file, and secret-bearing values were not emitted into reports or child QA environments.

Current tenant-isolation status: **Closed for the controlled private-beta pilot on this tested snapshot.** No known P0/P1 tenant-isolation finding remains. Live POS, Gmail, supplier sending, OpenAI execution, production promotion, and public-launch operational/legal work remain explicitly out of scope and disabled.

## July 17 tenant-isolation closure continuation

The local tenant proof has been extended from policy-shape checks to complete table-boundary behavior. A rollback-only pgTAP helper first proves in a trusted fixture context that each mutation is structurally valid and targets its intended row, then replays the INSERT, UPDATE, and DELETE as a manager from an unrelated restaurant and requires zero affected rows. The probes cover all 15 operational tenant tables; workflow tables remain RPC-only for every client role. Exact allowlists now also fail the suite if an unexpected `public` or `private` table appears. The reviewed catalog contains 18 application tables, 7 global service-only outreach tables with no app-user grants or policies, and 4 private tables.

Hosted proof was expanded without weakening the staging preflight:

- `staging:seed` now creates complete A/B fixtures for every operational table plus an unrelated Tenant C with independently authorized verification access. `staging:tenant-check` reads every operational table, submits structurally valid Tenant C INSERTs, targets real Tenant B rows with UPDATE/DELETE, and confirms all protected rows remain unchanged.
- `staging:edge-concurrency` first proves each tenant function crosses its legitimate same-tenant role boundary, then forges Tenant B through all five tenant Edge Functions using a Tenant A caller authorized for that function and requires 403 before continuing to lifecycle and concurrency checks.
- New `staging:service-rpc` uses the trusted service key only after project-reference and database-marker verification, then proves every service-role operational RPC rechecks the supplied actor/tenant relationship. A valid same-tenant reservation is closed with exactly one terminal event.
- Hosted child processes receive only the credentials they need; Expo, Chrome, tenant, and Edge clients never inherit the service key.

Observed local evidence on July 17, 2026:

- `npm run verify:private-beta-security:local`: passed end to end.
- `npm run typecheck`: passed.
- `npm test`: 110/110 passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm run security:backend` and `npm run design:static`: passed.
- `npm run supabase:test`: clean reset and complete additive replay passed; 325/325 pgTAP assertions passed.
- Local workspace concurrency: exactly 5 accepted, 15 rejected, and 5 immutable allocations.
- `npx supabase db advisors --local --type security --fail-on error`: no issues found.
- Production Expo web export, 8/8 route smoke, and 12/12 mobile layout checks: passed.
- Hosted gate: failed closed before mutation because all six staging values are absent.

Status remains **Mitigated—hosted proof pending**. The local cross-tenant mutation reproduction now fails across the complete operational table surface, but deployed Data API, RPC, Edge, membership-revocation, client-race, and concurrency behavior remains unobserved. Mise is not marked Pilot-ready.

## July 16 tenant-isolation reinforcement addendum

The restored checkout was revalidated rather than relying on the July 15 result. A rollback-only database PoC then confirmed the remaining authority bypass: when another active owner existed, an authenticated owner could directly update their own `restaurant_memberships` row from `owner` to `staff`. The same broad table grant also prevented one central role hierarchy from being authoritative.

Implemented control:

- Additive migration `20260716204112_reinforce_tenant_isolation.sql` revokes direct authenticated membership INSERT/UPDATE/DELETE and all direct `public.users` UPDATE.
- Guarded membership RPCs prohibit self-mutation, allow owners to promote only another active member to owner, prohibit every client from changing/removing an owner, and constrain admins to manager/staff targets under a per-restaurant transaction advisory lock.
- `update_my_profile` changes only a 1–120 character display name. Legacy `users.role` and `users.restaurant_id` remain non-authoritative and client-immutable.
- The Data API is an explicit allowlist. `anon` has no `public`/`private` table privilege; authenticated workflow grants are narrow; default privileges fail closed; Storage and Realtime remain disabled.
- Edge audit persistence now uses `service_record_edge_audit_log`, which rechecks the supplied actor against live tenant membership in the same transaction. Reservation terminal rows use a composite `(restaurant_id, reservation_id)` foreign key.
- Hosted repository membership/profile actions use RPCs. The session layer revalidates live memberships on authorization denial, app foreground, and a 10-second safety interval; removal invalidates pending request generations and clears tenant-specific session state before another workspace can hydrate.
- The complete table, function, Edge, Storage, Realtime, and role matrices are in `docs/tenant-isolation-architecture-2026-07-16.md`.

Observed local evidence on July 16, 2026:

- `npm run typecheck`: passed.
- `npm test`: 93/93 passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm run security:backend`: passed.
- `npm run design:static`: passed.
- `npm run supabase:test`: clean reset and full additive replay passed; 228/228 pgTAP assertions passed.
- Local workspace concurrency: exactly 5 accepted, 15 rejected, and 5 immutable allocations.
- `npx supabase db advisors --local --type security`: no issues found.
- Production Expo web export: passed.
- Route smoke: 8/8 passed.
- Mobile layout: 12/12 passed at 390×844 with zero horizontal overflow.
- Updated staging seed/tenant harness syntax: passed.
- Hosted gate: failed closed before any mutation because all six required staging variables are absent.

The local reproduction is fixed and covered by catalog plus behavioral regression tests. Overall status is **Mitigated—hosted proof pending**, not `Closed`: membership revocation through the deployed Data API/RPC/Edge stack, client races, and the hosted 20-request concurrency proof have not run. Mise is not yet marked Pilot-ready.

## July 15 validated-scan repair addendum

The follow-up Codex Security scan `5725eec9-3945-44c6-955b-b04638fac0b4` was sealed before these repository edits. It validated five Medium and three Low findings. This addendum is the current repair position; the July 13 tables below remain as earlier audit history.

Current local evidence:

- `npm run typecheck`: passed.
- `npm test`: 89/89 passed, including 9 new remediation regressions.
- `npm audit --audit-level=high`: zero vulnerabilities.
- `npm run security:backend`: passed using a statement-aware final function inventory.
- Expo web export: passed.
- Route smoke: 8/8 passed.
- Mobile layout: 12/12 passed at 390×844 with zero horizontal overflow.
- `npm run supabase:test`: passed after a clean Supabase database reset and full additive migration replay; 128/128 pgTAP assertions pass.
- The local Supabase catalog proves guarded implementation functions are `SECURITY DEFINER` with an empty search path, public service wrappers are `SECURITY INVOKER`, and authenticated callers have no raw replacement or service-commit execution grant.
- The database suite creates five active owner workspaces and rejects the sixth, verifies bounded restaurant and supplier-order data, proves actor-derived audit semantics, exercises current/stale planning revisions, and proves rollback plus one-terminal-event behavior.
- Docker Desktop 4.82.0 is installed in user mode for the local gate. The test wrapper starts Supabase idempotently, resets the database, stages only non-secret pgTAP files in the system temporary directory, and gives child processes a minimal environment.
- Hosted verification: not run because the required six staging environment values are absent. No hosted check is recorded as skipped success.

| Validated finding | Severity | Implemented control | Local reproduction/evidence | Hosted evidence | Residual risk and status |
|---|---|---|---|---|---|
| `csf_7b03ee327e7352f34404f727` — unbounded owner workspaces | Medium | Database creation path takes a per-user transaction advisory lock, limits active owner workspaces to five, and bounds restaurant names to 120 characters. | Validation/unit assertions and backend gate pass; clean migration replay and sequential five/six database boundary exercise pass. | Not run. | Concurrent hosted behavior remains unobserved. **Mitigated—hosted proof pending**. |
| `csf_42f6e5faae513e567dc34812` — unbounded AI-insight body | Medium | Authentication precedes a streaming 64 KiB JSON-object reader; missing length and oversize return 411/413 before reservation/application work. | Exact 64 KiB, 64 KiB+1, and missing-length regressions pass. | Not run. | Gateway header/body behavior needs disposable staging proof. **Mitigated—hosted proof pending**. |
| `csf_a63da0f7229e51c6c4ad327f` — unbounded Gmail-link body | Medium | Same shared authenticated streaming body boundary and terminal-reservation lifecycle. | Shared boundary and handler-order regressions pass. | Not run. | Deployed Edge runtime behavior remains unobserved. **Mitigated—hosted proof pending**. |
| `csf_10dbe82037f7576d49da8af6` — unbounded supplier-email body | Medium | Same 64 KiB boundary; accepted reservations record exactly one blocked/completed/error terminal event, including missing/cross-tenant order failures. | Shared boundary and handler-order regressions pass; terminal uniqueness and grant assertions pass in pgTAP. | Not run. | Hosted terminal ledger proof is pending. **Mitigated—hosted proof pending**. |
| `csf_e68a6c387daa4569f80a943c` — unbounded POS-sync body | Medium | Authentication and 64 KiB body limit precede the eight-call reservation quota; staging suite tests oversize and missing-length requests before the 20-request race. | Boundary/unit tests pass; concurrency harness updated. | Not run. | Exact 8/12 concurrent split still requires staging. **Mitigated—hosted proof pending**. |
| `csf_8edfb523c57d5df45e5efcb6` — unbounded supplier notes | Low | 2,000-character UI/service/database limit, 64 KiB UTF-8 derived-message cap, legacy repair, and bounded single-pass presentation parser. | 2,000/2,001, multibyte-message, and bounded-display tests pass; final database constraints are present after clean replay. | Not run. | Hosted migration parity and device-cost proof are pending. **Mitigated—hosted proof pending**. |
| `csf_44264e5973bd075a556665ed` — client-authored operational insights | Low | New `operational-workflows` Edge calculation uses a service-only revision-checked commit; raw authenticated insight replacement is revoked and stale guidance is hidden while pending. | Repository/domain tests and pgTAP pass; authenticated raw/service commit denial and service-role-only access are proven in the final catalog. | Not run. | Deployed Edge parity remains unproven. **Mitigated—hosted proof pending**. |
| `csf_a70dbe16c822ffa0075c0f01` — client-authored purchase recommendations | Low | Server calculation marks generated rows `mise_rules` with their planning revision; raw replacement is revoked while manual manager recommendations retain separate provenance. | Authority/source, revision/source, and final-catalog grant assertions pass locally. | Not run. | Concurrent hosted workflow proof is pending. **Mitigated—hosted proof pending**. |

Nine additional repair targets were addressed with the validated findings: global planning revisions for different-row inventory/recipe races, pending/current setup semantics, terminal Edge lifecycle handling, exact staging project/marker preflight, loopback-only rendered staging tests, minimal Expo/Chrome/QA environments, filtered hosted child environments, and final-state privileged-function inventory. These controls now have source/unit evidence plus a clean official local Supabase replay and 128 passing pgTAP assertions. Hosted behavior remains pending because staging access is absent.

## July 13 closure position

The original scan report is preserved as audit history. This report tracks the remediation working tree and does not rewrite the captured findings.

All 20 Medium findings have an implemented or pre-existing control plus passing local source, unit, migration-replay, and pgTAP evidence. None is marked `Closed`, because the hosted staging suites have not run successfully. The 3 Low findings remain `Open` until every Medium hosted check passes, as required by the remediation sequence.

Status meanings:

- `Closed`: the original reproduction fails at every required local and hosted boundary.
- `Mitigated—hosted proof pending`: the control and local regression evidence exist, but required deployed behavior has not been observed in disposable staging.
- `Open`: final remediation validation has not started because a prerequisite gate is incomplete.

## Evidence collected

Passed on the current working tree:

- `npm run typecheck`
- `npm test`: 89/89
- `npm audit --audit-level=high`: 0 vulnerabilities
- `npm run security:backend`
- `npm run design:static`
- `npm run supabase:test`: clean reset, full migration replay, 128/128 assertions
- Expo web export
- `npm run qa:routes`: 8/8 routes
- `npm run qa:mobile-layout`: 12/12 routes at 390×844, zero horizontal overflow
- Syntax checks for the staging seed, tenant, Edge-concurrency, and rendered client-race harnesses
- Fail-closed closure preflight: `npm run verify:private-beta-security` exits nonzero when hosted credentials are absent

Not completed:

- `npm run verify:private-beta-security:hosted`: blocked because the six staging environment values are absent.
- No hosted result below is a skip represented as success.

## Medium findings

| Finding | Classification | Control | Reproduction used for closure | Local evidence | Hosted evidence | Residual risk and status |
|---|---|---|---|---|---|---|
| MIS-SEC-001 | Validated / Medium | Authenticated audit DML is revoked; semantic RPCs derive `actor_user_id` from `auth.uid()`. | Manager attempts direct self/forged audit inserts; owner inspects workflow actor. | Static grant checks and the 128-assertion pgTAP suite pass, including forge/actor assertions. | `staging:tenant-check` authored; not run. | A deployed migration/grant mismatch could reopen forgery. **Mitigated—hosted proof pending**. |
| MIS-SEC-002 | Validated / Medium | Insights use request generations, active-restaurant checks, and restaurant-tagged render state. | Hold tenant A Insights response, switch to B, release A, assert no A title/content. | `tests/clientTenantSafety.test.ts` passes; rendered race is implemented. | `staging:client-race` not run. | Browser/runtime behavior against real latency is unproven. **Mitigated—hosted proof pending**. |
| MIS-SEC-003 | Validated / Medium | Inventory list/detail clear state on switch and reject late responses and stale mutation continuations. | Hold A list/detail requests, switch and open B list/detail, release A. | Client tenant-safety and mobile layout tests pass. | Rendered list/detail race not run. | Real PostgREST ordering remains unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-004 | Validated / Medium | Order loads and mutation continuations are bound to the captured restaurant ID; authoritative reloads are guarded. | Hold A `mark_supplier_order_sent`, switch to B, release, prove B list/detail stay B-only. | Client tenant-safety and canonical workflow tests pass. | Rendered mutation race not run. | A browser-specific continuation bug could remain. **Mitigated—hosted proof pending**. |
| MIS-SEC-005 | Validated / Medium | Settings suppliers are tagged by loaded restaurant and late requests are rejected. | Hold A supplier-recipient response, switch to B, release A, assert only B supplier. | Client tenant-safety test passes. | Rendered Settings race not run. | Hosted failure/retry behavior remains unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-007 | Validated / Medium | Edge reservations serialize on actor/restaurant/function advisory locks and enforce the 8-per-60-second policy. | Send 20 simultaneous POS sync requests and require 8×202 plus 12×429. | Static backend checks and sequential reservation pgTAP assertions pass. | `staging:edge-concurrency` not run. | Only a deployed concurrent run proves serialization. **Mitigated—hosted proof pending**. |
| MIS-SEC-008 | Validated / Medium | Reservation and terminal telemetry RPCs are service-role-only; metadata is size-bounded/redacted and terminal events are reservation-unique. | Client calls service RPCs, staff/cross-tenant Edge calls, secret-like metadata, duplicate terminal event. | Static checks and pgTAP grant/one-terminal-event assertions pass. | Tenant/Edge suites not run. | Deployed Edge secrets/grants could differ. **Mitigated—hosted proof pending**. |
| MIS-SEC-009 | Validated / Medium | `replace_operational_signals` transactionally replaces pending recommendations and insights under advisory locks. | Race two distinct complete sets; final state must equal exactly one set. | Transaction/lock source tests and rollback pgTAP assertions pass. | Concurrent hosted replacement not run. | True transaction concurrency is unproven. **Mitigated—hosted proof pending**. |
| MIS-SEC-011 | Validated / Medium | Inventory edits and regenerated recommendations/insights use one optimistic, transactional RPC. | Inject invalid insight during count update; then submit stale editor version. | Service/source tests and pgTAP rollback/stale-revision assertions pass. | Hosted workflow test not run. | Current deployed function may not match local migration. **Mitigated—hosted proof pending**. |
| MIS-SEC-013 | Validated / Medium | Mutation services reject rather than clamp invalid quantities; RPC validation and table constraints bound inventory and planning values. | Negative, non-finite, and over-limit inventory/POS values at each boundary. | Unit validation and database constraint assertions pass. | Hosted boundary run not completed. | Deployed constraint parity is pending. **Mitigated—hosted proof pending**. |
| MIS-SEC-014 | Validated / Medium | Learning requires at least 3 recent unit-compatible samples, uses a median, and rejects values outside bounded deviation from calculated demand/par. | Supply one anomaly, stale history, incompatible units, then valid repeated recent samples. | Pure domain regressions pass. | Hosted history workflow not run. | Forged history is also dependent on MIS-SEC-016 grants. **Mitigated—hosted proof pending**. |
| MIS-SEC-015 | Validated / Medium | UI and application service reject non-finite/≤0/>1,000,000 quantities; additive migration enforces the same rule on every approval RPC call; table constraint remains authoritative. | Submit -1, 0, NaN, 1,000,001, then a valid 12 and replay. | Unit/source tests pass; the additive migration replays and its pgTAP bounds pass. | Hosted approval boundary test not run. | The migration has not been staged. **Mitigated—hosted proof pending**. |
| MIS-SEC-016 | Validated / Medium | Recommendation INSERT/UPDATE/DELETE is revoked; guarded RPCs own creation/replacement/transitions. | Manager attempts to insert/update learning history directly. | Static grant/repository checks and direct-DML pgTAP assertions pass. | Hosted Data API denial not run. | Hosted grants may drift. **Mitigated—hosted proof pending**. |
| MIS-SEC-017 | Validated / Medium | Approval/dismiss/undo RPCs lock rows, enforce legal transitions, derive audit semantics, and make replays explicit. | Direct update, legal approval, illegal handled transition, and replay. | Unit/static tests and pgTAP workflow assertions pass. | Hosted state-machine test not run. | Deployed behavior remains unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-018 | Validated / Medium | Setup CSV is limited to 256,000 characters/1,000 rows; setup RPC caps all arrays and rolls back invalid payloads. | Oversize character/row CSV and 1,001-row RPC payload. | Parser and setup-cap pgTAP assertions pass. | Hosted setup test not run. | Large-payload behavior in deployed PostgREST is unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-019 | Validated / Medium | Setup inventory values are finite/bounded in client parsing, setup RPC, and table constraints. | Negative/non-finite/over-limit inventory row mixed with valid rows; require no writes. | Unit/static and atomic invalid-row rollback assertions pass. | Hosted atomic setup test not run. | Deployed rollback parity is pending. **Mitigated—hosted proof pending**. |
| MIS-SEC-020 | Validated / Medium | POS quantities/sales are finite and bounded; rounding is rechecked; RPC/table limits mirror the client. | Negative, zero, NaN, Infinity, and limit+1 values. | CSV parser, static constraint, and pgTAP constraint assertions pass. | Hosted boundary test not run. | Serialization/runtime edge cases remain unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-021 | Validated / Medium | Stable source fingerprints plus `(restaurant_id, source_pos, source_record_id)` uniqueness make setup retry idempotent. | Import, reorder identical rows, retry, and require one row per source identity. | Stable-ID unit and setup-replay pgTAP assertions pass. | Hosted retry test not run. | Deployed index/migration state is unverified. **Mitigated—hosted proof pending**. |
| MIS-SEC-022 | Validated / Medium | Recipe quantities are bounded to >0 and ≤10,000 in setup/edit RPCs; recipe and signals commit atomically with optimistic versions. | Zero/non-finite/over-limit baseline, invalid regenerated insight, stale edit. | Service/source and pgTAP constraint/rollback/stale assertions pass. | Hosted recipe workflow not run. | Deployed behavior remains unobserved. **Mitigated—hosted proof pending**. |
| MIS-SEC-023 | Validated / Medium | Supplier-order DML is revoked; draft edit and mark-sent RPCs enforce the state machine, update recommendations atomically, and emit one derived audit event. | Direct DML, send, replay, edit-after-send, and forged transition. | Canonical workflow and pgTAP transition/audit assertions pass. | Hosted workflow test not run. | Deployed grants/state machine remain unverified. **Mitigated—hosted proof pending**. |

## Low findings

The Low closure phase is intentionally not executed until all Medium hosted proofs pass.

| Finding | Classification | Control | Reproduction reserved for closure | Local evidence | Hosted evidence | Residual risk and status |
|---|---|---|---|---|---|---|
| MIS-SEC-006 | Validated / Low | Unauthorized attempts return before tenant-attributed private ledger writes; telemetry RPCs are service-role-only. | Staff/cross-tenant reservation plus direct authenticated telemetry RPC. | Static checks and service-only grant/ledger pgTAP assertions pass. | Not run. | Medium Edge authority hosted proof is prerequisite. **Open**. |
| MIS-SEC-010 | Validated / Low | Insight replacement is transaction-scoped, lock-serialized, and validates the complete set before commit. | Failed and concurrent replacement must preserve one complete current set with no duplicates. | Rollback assertions pass locally; true concurrency remains in the hosted harness. | Not run. | MIS-SEC-009 must pass first. **Open**. |
| MIS-SEC-012 | Validated / Low | Inventory update and regenerated recommendation/insight sets execute in one PostgreSQL transaction. | Force signal failure and verify count plus both signal sets remain unchanged. | Source/unit and pgTAP atomic rollback proof pass. | Not run. | MIS-SEC-011 must pass first. **Open**. |

## Verification commands

Local-only evidence:

```bash
npm run verify:private-beta-security:local
```

Hosted-only evidence, using a disposable staging project and locally loaded secrets:

```bash
npm run verify:private-beta-security:hosted
```

Combined closure, which preflights hosted access and fails rather than skipping it:

```bash
npm run verify:private-beta-security
```

The hosted bootstrap uses the Supabase Auth Admin API from trusted Node code. The secret key is never read by Expo or committed. This follows [Supabase user administration guidance](https://supabase.com/docs/guides/auth/users) and keeps exposed database objects behind explicit grants plus RLS as described in [Supabase Data API security guidance](https://supabase.com/docs/guides/api/securing-your-api).

## Required closure follow-up

1. Load the six staging values from the trusted local/CI secret store.
2. Apply the additive migrations and configure the matching `private.environment_identity` marker in a disposable staging project.
3. Run `npm run verify:private-beta-security:hosted` without skips.
4. Change Medium statuses only from observed evidence. Begin Low closure only after every Medium row is `Closed`.
