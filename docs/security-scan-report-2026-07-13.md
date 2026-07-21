# Mise Security Scan Report

Date: July 13, 2026  
Target: `/Users/RAW/Documents/Mise`  
Snapshot: `codex-security-snapshot/v1:sha256:b1566b4c78e32a71fe5c86f72a20db2ec079182374c360cf3ed1a6605c9a8b69`  
Assessment type: repository-wide source, configuration, migration, and local execution review

## Executive summary

The scan produced 23 validated findings: 20 Medium and 3 Low. No Critical or High findings were identified.

Mise's strongest control is tenant isolation at the database boundary: the reviewed paths generally retain restaurant-scoped RLS and do not provide an unauthenticated or arbitrary cross-tenant business-data primitive. The dominant risk is integrity inside an authorized restaurant. Manager-capable clients can bypass server workflows through direct Data API writes, extreme or replayed planning inputs can corrupt recommendations, and several multi-step replacements are not atomic.

Four client screens also allowed data from one authorized restaurant workspace to render under another after a switch. The backend still scoped each response correctly, but the client could mislabel stale data and lead an operator to act in the wrong restaurant context.

The report describes the captured snapshot. Client-side changes made after capture are source drift and are not treated as proof that a finding is closed. Hosted Supabase validation was not performed because staging credentials were not available.

## Severity summary

| Severity | Count | Meaning in this scan |
|---|---:|---|
| Critical | 0 | No system-wide compromise path identified |
| High | 0 | No direct cross-tenant takeover or automatic supplier action identified |
| Medium | 20 | Material tenant integrity, disclosure, audit, or resource-control weakness |
| Low | 3 | Contained telemetry or consistency weakness with additional preconditions |

## Principal risks

1. **Direct writes bypass workflow invariants.** Manager-level Data API access can forge or mutate recommendation history, supplier-order state, and audit semantics without the guarded RPC transitions.
2. **Planning evidence is insufficiently bounded.** Extreme numeric values, replayed setup rows, and one anomalous historical quantity can materially distort purchase recommendations.
3. **Replacement workflows are not atomic.** Inventory/recommendation and insight refreshes can partially commit, duplicate data, or erase the last good result.
4. **Workspace identity is not bound to asynchronous client state.** Late requests and failed reloads can show restaurant A data while restaurant B is active.
5. **Edge security controls are forgeable or racy.** Concurrent reservations can exceed rate limits, and authenticated callers can contaminate private security telemetry.

## Validated findings

| ID | Severity | Finding | Primary impact |
|---:|---|---|---|
| MIS-SEC-001 | Medium | Authenticated managers can forge tenant audit events through the Data API | Audit integrity and ledger growth |
| MIS-SEC-002 | Medium | Previous-restaurant insights survive a workspace switch | Cross-workspace disclosure and decision integrity |
| MIS-SEC-003 | Medium | Inventory from one restaurant can render under another workspace | Cross-workspace disclosure and ordering mistakes |
| MIS-SEC-004 | Medium | A completed order mutation can refresh the previous workspace into Orders | Cross-workspace supplier/order disclosure |
| MIS-SEC-005 | Medium | Previous-restaurant supplier settings survive a workspace switch | Cross-workspace supplier disclosure |
| MIS-SEC-006 | Low | Authenticated users can flood another tenant's private Edge security ledger | Telemetry contamination and storage pressure |
| MIS-SEC-007 | Medium | Parallel Edge invocations can bypass the database rate limiter | Burst resource consumption and quota bypass |
| MIS-SEC-008 | Medium | Restaurant members can forge and flood Edge security telemetry | Incident-evidence integrity and storage pressure |
| MIS-SEC-009 | Medium | Manager insight refreshes append duplicate signal sets | Duplicated manager brief and unbounded growth |
| MIS-SEC-010 | Low | Insight replacement can duplicate or erase the manager brief | Availability and consistency loss |
| MIS-SEC-011 | Medium | Manager inventory edits leave stale pending recommendations under current RLS | Stale or contradictory purchase guidance |
| MIS-SEC-012 | Low | Inventory updates can commit without refreshed recommendations | Partial commit and stale guidance |
| MIS-SEC-013 | Medium | Inventory inputs are silently coerced and can create extreme recommendations | Unsafe planning output |
| MIS-SEC-014 | Medium | One anomalous order indefinitely replaces calculated recommendations | Persistent recommendation poisoning |
| MIS-SEC-015 | Medium | Approval accepts zero and extreme supplier-order quantities | Invalid drafts and poisoned learning history |
| MIS-SEC-016 | Medium | Managers can forge recommendation learning history | Workflow and learning-integrity bypass |
| MIS-SEC-017 | Medium | Direct recommendation updates bypass the order workflow | State-machine, audit, and learning corruption |
| MIS-SEC-018 | Medium | Setup POS CSV import has no size or row limit | Client/database resource exhaustion and partial imports |
| MIS-SEC-019 | Medium | Unbounded setup inventory values corrupt purchase recommendations | Unsafe planning output |
| MIS-SEC-020 | Medium | POS setup CSV accepts extreme values and overflows after validation | Planning corruption or partial setup failure |
| MIS-SEC-021 | Medium | Setup retries duplicate imported POS sales | Replay-driven depletion and order inflation |
| MIS-SEC-022 | Medium | Unbounded recipe baselines force false critical depletion and supplier orders | Unsafe planning output |
| MIS-SEC-023 | Medium | Managers can bypass the supplier-order state machine | Forged sent history and inconsistent recommendations |

## Recommended remediation order

### P0 — Before relying on paid or production workflows

- Revoke direct authenticated `INSERT`/`UPDATE` access to `purchase_recommendations`, `supplier_orders`, and semantic audit/security ledgers.
- Make approval, dismissal, undo, order sending, inventory refresh, insight replacement, and setup import server-owned transactional workflows.
- Add database-enforced operational bounds and transition constraints; do not rely on the Expo client for authority.

### P1 — Before expanding the private beta

- Add stable import idempotency keys, bounded batch imports, and atomic setup persistence.
- Require multiple recent, unit-compatible samples for learned quantities; use robust statistics and cap deviation from calculated need/par.
- Bind every client request and mutation continuation to the active restaurant ID and request generation; clear tenant-owned state immediately on switch.
- Serialize Edge reservations per actor/restaurant/function key and restrict terminal security-event writes to trusted server execution.

### P2 — Verification and prevention

- Add two-tenant race and failure-injection tests for every workspace screen and replacement workflow.
- Add concurrent rate-limit tests, direct Data API negative tests, and forged-history regression tests.
- Run the hosted tenant test suite against staging with owner, manager, staff, and cross-tenant seed accounts.
- Alert on ledger growth, repeated denied events, duplicate insight generations, and unusually large planning values.

## Positive controls observed

- Restaurant-scoped RLS and composite tenant references materially limit cross-tenant business-data access.
- Sensitive order workflows already have guarded RPC implementations with locking and audit behavior; the main issue is parallel direct table access.
- Supplier email is not automatically sent by the affected local approval/order paths, reducing immediate external impact.
- Security-event tables are private from ordinary reads, and server-derived actor IDs limit impersonation.
- The repository includes static security gates and a staging tenant-check harness.

## Verification status

Current local working-tree checks:

- TypeScript compilation: passed
- Unit/security tests: 75 passed
- Dependency audit: 0 known vulnerabilities
- Static backend security gate: passed
- Fresh PostgreSQL migration replay: passed
- Database tenant/isolation assertions: 97 passed
- Hosted staging tenant checks: not run; requires `SUPABASE_STAGING_URL`, `SUPABASE_STAGING_ANON_KEY`, and `MISE_STAGING_SEED_PASSWORD`

The fresh-database replay and expanded tests include post-scan hardening for direct workflow grants, bounded numeric inputs, fixed-semantic audit writes, replay-safe atomic setup persistence, optimistic inventory and recipe updates, transactional recommendation/insight replacement, robust bounded historical learning, reservation-bound Edge telemetry, and active-restaurant provenance on operational client state. Source regression tests and the rendered Golden China core workflow pass across guided setup, inventory, orders, recipes, Insights, demo POS, session exit, and recovery; a hosted two-tenant race run is still required to validate the workspace-switch fixes against real Supabase latency. These results validate the current local working tree, but they do not retroactively alter the 23 findings recorded against the captured scan snapshot. A hosted re-scan is required before marking findings closed in production.

## Method and limitations

The review traced authentication, membership checks, RLS policies, grants, database functions, Edge Function helpers, Expo state transitions, setup parsers, repository persistence, and recommendation consumers. Local probes were used where a finding could be demonstrated without external writes.

No requests were sent to a hosted Mise tenant. The repository had no reliable revision history for introduction/fix attribution. Medium severity does not mean the issues should be deferred: several sit directly on the operator-to-automation trust boundary and should be addressed before the system is allowed to place or send real supplier orders.
