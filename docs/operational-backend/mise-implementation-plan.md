# Mise operational backend implementation plan

Authoritative product spec: `docs/MISE_OPERATIONAL_BACKEND_MASTER_PROMPT.md`  
Completed foundation batch: `operational-backend-foundation-40`

## Completed in this batch

### Phase 1 — trustworthy operational foundation

- Tenant-scoped issues, activity, actions, outcomes, memory, autonomy, confirmations, deliveries, and delivery items
- Append-only truth records, RLS, role-gated RPCs, emergency-mode guards, explicit service grants, and truthful backfill
- Hosted and demo repository/application parity behind `services/miseService.ts`

### Phase 2 — operating-brief Home

- Deterministic overall status, freshness/confidence, approvals, monitoring, recent/since-away activity, and concise routes to the affected workflow
- One-tap approval for purchase recommendations and prepared Mise actions
- Ask Mise remains secondary and evidence-bound

### Phase 3 — inventory-to-order vertical slice

`POS/history → depletion → issue/recommendation → draft → approval → send → confirmation/delivery → inventory receipt → outcome → memory`

- Send is approval-gated and failure/ambiguity is visible
- Delivery receive is replay-safe and atomic with inventory projection
- Outcome and supplier reliability memory are inspectable

### Phase 4 — correctable restaurant memory

- Evidence, confidence, last-updated state, confirm/correct/dismiss/disable/forget controls
- Safe-rule conversion produces an owner-controlled rule draft

### Phase 5 — autonomy and permissions

- Safe defaults for existing and empty tenants
- Level, approval, spend, supplier, communication, and allowed-time scopes
- External send remains approval-required unless an owner/admin explicitly changes a safe bounded rule and provider gates also permit it

### Phase 6 — polish and verification

- Status vocabulary consolidated across Home, Today, Inventory, Orders, and Activity
- English, Spanish, and Simplified Chinese mobile interaction QA
- 390×844 overflow and route coverage
- Deno Edge typecheck, TypeScript, unit/domain, security, export, Expo Doctor, and pgTAP proof

## Batch daily-operating-plan-41 (complete locally)

### Cursor — Daily Operating Plan projection

- Deterministic windowed plan items for Today (`buildDailyOperatingPlan`)
- Why / needed-by / effect, structured kind, related refs, evidenced dependency IDs
- Verification method; completion results only from source/activity state
- Cutoff-like reprioritization limited to overdue/delivery-due/stock-risk/provider-failure/due-soon reasons
- Demo/hosted parity via shared application facade (no fabricated staffing/weather/reservations)
- Section 11 Morning/Pre-Service/Closing briefs deferred to a later slice

### Codex — durable restaurant tasks and integration

- Tenant-scoped tasks and dependency edges with active-membership RLS, direct-write revocation, role-gated create/complete/reopen RPCs, immutable activity, operational-mode guards, and explicit export coverage
- Hosted/demo repository parity behind the stable `miseService.ts` facade
- Restaurant/Personal scope selection, service windows, role and assignee selection, verification method, checklist, prerequisite selection, and central task lists
- Today merge, task detail, checklist/evidence gating, truthful completion results, transactional unblocking, and manager reopen
- Local proof: 411 TypeScript tests, 656 pgTAP assertions, security/design/build gates, and rendered mobile interaction QA

## Batch waste-analysis-42 (complete locally)

### Deterministic waste intelligence

- Bounded current/prior 7-day analysis over append-only waste and correction events
- Verified canonical conversion and item cost are required for dollar estimates; incomplete cost setup remains explicit
- Repeated-item and material cost-increase signals, recent evidence, exact item routes, and truthful no-data states
- Persistent demo-ledger parity, tenant-scoped activity/audit/export evidence, and hosted trigger migration
- Compact mobile Waste Analysis surface plus a matching Daily Report section and More entry
- English, Spanish, and Simplified Chinese catalog parity with route, interaction, type, domain, security, and export verification
- Local proof: 434 TypeScript tests, 665 pgTAP assertions, migration lint, security/design gates, production export, and rendered mobile interaction QA

## Batch phase-briefs-43 (complete locally)

### Section 11 operating narratives

- Deterministic Morning, Pre-Service, and Closing briefs composed from the operating plan, operating brief, daily report, closeout, and waste evidence
- Three-to-five finding cap with interpretation, evidence references, and direct routes instead of dashboard repetition
- Explicit unavailable-signal boundaries for staffing, reservations, stations, rush timing, forecasts, and service-issue feeds
- Restaurant-local active phase, interactive phase switching, and a truthful Closing “Good work” acknowledgment over evidenced completion
- Localized English, Spanish, and Simplified Chinese screen chrome with stale-response protection
- Local proof: 439 TypeScript tests, 665 pgTAP assertions, security/design gates, production export, route coverage, and rendered multilingual interaction QA

## Next roadmap increments

1. Deploy remaining additive migrations to staging and run hosted tenant/provider proofs.
2. Connect schedules, reservations, weather, review monitoring, and provider confirmations before surfacing those signals as known.
3. Add scheduled daily/mid-shift/close recalculation cycles with explicit monitoring ownership.
4. Complete physical-device and external release evidence under `docs/launch/GATE_STATUS.md`.

## Rollback and safety

The migration is additive. Provider and automation kill switches remain default-off.
Removing the new UI projections does not remove historical truth. Never roll back
by deleting activity, outcomes, inventory events, or audit evidence.
