# Mise current-state audit (operational backend)

Last updated: 2026-08-03  
Scope: implemented foundation for `docs/MISE_OPERATIONAL_BACKEND_MASTER_PROMPT.md`

## Stack and boundaries

- Expo Router + React Native + TypeScript client
- Supabase Postgres, RLS, SECURITY DEFINER workflows, and Edge Functions in hosted mode
- Replaceable, clearly labeled local demo repository with matching decision surfaces
- Stable screen facade: `services/miseService.ts` → application → domain → repositories
- Deterministic rules own operational facts; model output is never inventory, price, permission, or delivery authority

## Operating loop now implemented

| Loop step | Implemented foundation | Intentional boundary |
| --- | --- | --- |
| Observe | POS sales, append-only inventory ledger, sales imports, supplier delivery rows, persisted waste events, real `activity_events` | Staffing, reservations, and weather remain unknown until integrations exist |
| Understand | Deterministic daily findings, 7-day waste analysis, `operational_issues`, operating brief, grouped activity evidence | No LLM may rewrite source evidence or invent missing waste cost |
| Predict | Restaurant-history demand baselines, coverage, freshness, confidence, and non-contradictory inventory status | Demo fallback is injected only in demo mode |
| Decide | Purchase recommendations plus first-class `mise_actions` and owner-visible expected impact | External actions require an authorized decision by default |
| Act | Approve/dismiss, draft, approved supplier send, receive delivery, inventory projection | Provider sends remain kill-switch gated and never auto-retry ambiguous sends |
| Verify | Supplier confirmations, deliveries, append-only `action_outcomes`, audit/activity failure visibility | A send without definitive provider evidence is `unverified`, never `completed` |
| Learn | Correctable `restaurant_memories` with bounded evidence and supplier-reliability learning | Dismissed, forgotten, or disabled memories are not silently recreated |

## Product surfaces

- Home is an operating brief with overall status, confidence/freshness, approvals, recent activity, monitoring, and a secondary Ask Mise entry.
- Today renders a deterministic Daily Operating Plan over projected workflows and durable restaurant-wide tasks: service windows, why/needed-by/effect, assignment and role, evidenced dependencies, verification, truthful completion results, and overdue/delivery/risk reprioritization.
- Daily Brief now provides interactive Morning, Pre-Service, and Closing narratives with three to five interpreted priorities, exact evidence routes, and explicit unknown-signal boundaries; the Closing phase preserves the evidenced “Good work” acknowledgment.
- Inventory explains projected quantity, coverage, status, and recommended action without contradictory labels.
- Orders exposes draft/review/sent/history lanes, approval-safe delivery, and delivery receipt completion.
- Insights displays deterministic daily findings and the sales view.
- Waste Analysis turns verified inventory-ledger evidence into a bounded 7-day cost, repeated-item, trend, and recent-record review; missing evidence is reported as unknown, never as zero waste.
- Daily Report includes the same waste summary and routes directly into the evidence review.
- Activity History has date and semantic filters plus expandable trigger/evidence/metadata.
- Restaurant Memory supports confirm, correct, dismiss, disable, forget, and safe-rule conversion.
- Autonomy rules default to approval and expose level, spend, supplier, communication, and time scopes.
- Owner/admin restaurant export includes the operational-backend and shared-task datasets.

## Persistence and security

- Eleven tenant-scoped operational-foundation/shared-task tables are protected by RLS and explicit grants.
- `activity_events` and `action_outcomes` are append-only.
- Client mutations go through role-gated RPCs; clients have no direct write grant to the new tables.
- Service-role privileges are explicit per table and do not include `TRUNCATE`.
- Existing recommendations and persisted supplier orders receive a truthful one-time issue/action/activity backfill.
- Emergency/read-only operational-mode guards cover every new table.

## Remaining roadmap, not foundation defects

1. Connect staffing, reservations, weather, review monitoring, and additional POS/provider signals before claiming those domains are known.
2. Prove live provider confirmation and delivery parsing on a configured hosted environment before enabling any higher autonomy.
3. Add scheduled daily/mid-shift/close operating cycles once the foundation is deployed and observed safely.
4. Complete physical-iPhone, staging migration, and managed recovery evidence under the existing release gates.
