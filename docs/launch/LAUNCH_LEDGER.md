# Mise Launch Ledger

This ledger is the durable handoff between Codex and Cursor. Each batch must have
exclusive ownership, test evidence, unresolved findings, and a local checkpoint
commit before another batch begins.

## Operating rules

- Cursor owns Expo screens, navigation, visual design, accessibility, localization,
  interaction design, and real-device UI verification unless a batch says otherwise.
- Codex owns domain logic, service contracts, repositories, Supabase, integrations,
  billing evidence, security, and backend tests unless a batch says otherwise.
- Only one agent may edit a shared or locked file at a time.
- An agent must update `CURRENT_BATCH.yaml` before changing ownership.
- A batch cannot close with an unrecorded P0 or P1 finding.
- Local checkpoint commits are allowed. Pushes, merges, releases, and production
  deployments require Raymond's explicit approval.

## Batches

| Batch | Owner | Goal | Status | Checkpoint |
| --- | --- | --- | --- | --- |
| `operational-data-foundation-01` | Codex | Tenant-safe operational mappings and append-only inventory events | Complete | `dbe0cc4` |
| `private-beta-account-inventory-replay-02` | Tandem | Account controls plus replay-safe inventory reconciliation | Complete | `c82ecf4` |
| `inventory-outbox-device-03` | Codex | Serialized device persistence for offline inventory events | Complete | `38aaaf9` |
| `inventory-hosted-submission-04` | Codex | Authoritative hosted and deterministic demo inventory submission | Complete | `d41ff1e` |
| `inventory-operation-input-05` | Codex | Bounded operator receiving, count, waste, and stockout commands | Complete | `3aa16e3` |
| `inventory-canonical-authority-06` | Codex | Verified item-unit authority at the inventory ledger boundary | Complete | `4184fdd` |
| `inventory-verification-sales-import-07` | Tandem | Typed unit verification plus daily sales CSV cold start | Complete | `3cff0c1` / `3581375` |
| `private-beta-inventory-closure-08` | Tandem | Hosted tenant proof plus append-only mobile inventory operations | Complete | `d4dfd28` / `debf9f1` |
| `private-beta-operations-observability-09` | Codex | Scrubbed correlation, live receipt proof, and alert ownership | Complete; activation evidence pending | `1d16169` |
| `private-beta-recovery-lifecycle-10` | Codex | Isolated restore proof and beta incident/data-lifecycle authority | Complete; managed recovery pending | `63cd913` |
| `private-beta-emergency-control-11` | Codex | Enforced read-only/emergency tenant mutation authority | Complete | `6d4d18f` |
| `private-beta-account-lifecycle-proof-12` | Codex | Disposable hosted account-deletion and tenant-safety proof | Complete; device proof pending | `fe576a7` |
| `private-beta-data-export-authority-13` | Codex | Bounded, tenant-safe restaurant data export | Complete; UI handoff pending | `875ce5a` |
| `private-beta-daily-findings-contract-14` | Codex | Deterministic evidence-backed daily brief | Complete; UI handoff pending | `e81dbb5` |
| `private-beta-rendered-race-harness-15` | Codex | Bounded hosted rendered race verification | Complete | `ba3b427` |
| `private-beta-export-client-contract-16` | Codex | Typed hosted/demo export facade | Complete; UI handoff ready | `3bf2058` |
| `private-beta-finding-feedback-17` | Codex | Append-only manager feedback linked to deterministic findings | Complete; UI handoff ready | `c0439c0` |
| `private-beta-finding-feedback-loop-18` | Codex | Apply exact manager feedback to later deterministic briefs | Complete; UI handoff ready | `17e14d9` |
| `private-beta-finding-feedback-outbox-19` | Codex | Restart-safe device delivery for manager feedback | Complete; UI handoff ready | `13bbeb1` |
| `private-beta-release-authority-20` | Codex | Exact-commit August 3 beta go/no-go authority | Complete; external evidence pending | `8b93f47` |
| `private-beta-operator-ui-21` | Cursor + Codex review | Daily Brief, finding feedback, and restaurant export UI | Complete; device proof pending | `828555e` |

### `private-beta-operator-ui-21`

Delivered:

- Localized, scan-first Now, Up next, and Later findings on Today and Insights.
- Owner/admin/manager approve, edit, and dismiss controls through only the
  restart-safe device outbox facade; staff remains read-only.
- Original findings remain visible after feedback. Queue badges bind only to
  the exact current evidence snapshot, so changed evidence, action, or policy
  cannot inherit an old accepted state.
- Independently accessible action controls, 44px targets, bounded edit input,
  loading/error/stale/incomplete/permission states, and live result copy.
- Owner/admin-only restaurant JSON export with native sharing and bounded web
  download, payload-safe telemetry, cancellation-safe tenant switching, and
  explicit credential/security-log exclusions.

Evidence:

- Cursor feature checkpoint `a17c136`; Codex-reviewed hardening checkpoint
  `828555e`
- `npm run typecheck`
- `npm test`: 303 passed
- `npm run design:static`
- `npm run qa:interactions`: English, Spanish, and Simplified Chinese at
  390x844 with zero overflow on every existing smoke route
- `git diff --check`

Remaining:

- Add `/settings/export` to the Codex-owned rendered route harness.
- Test export sharing, interruption, feedback recovery, and accessibility on
  physical iPhones.

### `private-beta-release-authority-20`

Delivered:

- A typed, fail-closed release evaluator and `npm run beta:go-no-go` command.
- Twelve required evidence receipts covering local/hosted gates, isolation,
  managed recovery, live telemetry, two real devices, critical workflows,
  monitored privacy/support, TestFlight installation, and provider
  restrictions.
- Exact-candidate verification for every receipt and Raymond approval.
  Evidence-only commits may follow the tested candidate, but any product,
  schema, configuration, or uncommitted workspace change blocks release.
- Explicit beta enforcement for disabled Square, Gmail delivery, AI, billing,
  autonomous ordering, and supplier delivery from Mise.
- August 3 owner and TestFlight guidance aligned to one restaurant first and a
  second only after one healthy operating day.
- Removed stale August 24/public-launch and Resend supplier-delivery guidance
  from the beta path.

Evidence:

- `npm run typecheck`
- `npm test`: 300 passed
- `npm run security:backend`
- `git diff --check`
- `npm run beta:go-no-go` correctly reports BLOCKED with 0/12 receipts, no
  candidate build, and no Raymond approval.

Remaining:

- External owners must populate durable receipts only after testing the exact
  candidate build. No checklist item is self-attesting.
- The beta cannot open until the command exits successfully.

### `private-beta-finding-feedback-outbox-19`

Delivered:

- A tenant-scoped AsyncStorage outbox for manager finding decisions behind the
  stable Mise service facade.
- One generated client event and idempotency key persist across repository and
  app restarts, transient failures, and interrupted submissions.
- Serialized device flushes prevent concurrent local replay. Retry timing uses
  bounded exponential backoff.
- Authoritative responses must match the restaurant, finding, policy, decision,
  client event, and idempotency identity before an entry settles accepted.
- Permission denials and changed-payload idempotency conflicts settle as
  visible terminal states; ambiguous transport failures remain retryable.
- Corrupt, cross-tenant, oversized, or locally identity-conflicting persisted
  payloads fail closed.

Evidence:

- `npm run typecheck`
- `npm test`: 293 passed
- `npm run security:backend`
- `git diff --check`

Remaining handoff:

- Cursor uses the queue, list, and flush facade methods for the feedback
  interaction and renders accepted, pending, conflict, rejected, and retry
  states.
- Real-device interruption and offline recovery remain release evidence.

### `private-beta-finding-feedback-loop-18`

Delivered:

- Daily briefs load restaurant evidence and append-only manager decisions
  through the stable repository and service boundaries.
- Only the latest decision matching the exact restaurant, finding ID, policy,
  category, severity, confidence, original action, evidence, and source window
  affects a finding.
- Approved, edited, and dismissed findings remain visible with their original
  evidence and recommendation; handled work moves to Later and exposes a
  separate effective manager action.
- Changed evidence, recommendations, or policy versions automatically require
  a fresh decision. Mixed-tenant feedback fails closed.
- Same-day data-gap evidence is stable across refreshes and expires on the next
  operating day.

Evidence:

- `npm run typecheck`
- `npm test`: 287 passed
- `npm run security:backend`
- `git diff --check`
- No inventory event, recommendation, supplier draft, or order authority was
  added to the feedback lifecycle.

Remaining handoff:

- Cursor renders the returned `managerFeedback` state and records actions only
  through the stable Mise service facade.
- Real-device feedback, retry, accessibility, and locale verification remain
  release evidence.

### `private-beta-finding-feedback-17`

Delivered:

- A tenant-scoped append-only `operational_finding_decisions` ledger linked to
  the exact finding ID, policy version, generated time, confidence, evidence,
  original action, and manager decision.
- A manager-authorized, replay-safe RPC for approved, edited, and dismissed
  feedback. Staff, anonymous, direct-DML, and cross-tenant attempts fail closed.
- Immutable actor-preserving history that permits only Auth-owned actor
  anonymization and whole-restaurant deletion cascades.
- Emergency/read-only enforcement, bounded evidence allowlists, protected-key
  rejection, audit evidence, and 180-day bounded learning reads.
- Stable `recordOperationalFindingDecision` and
  `fetchOperationalFindingDecisions` screen-facing methods with hosted and
  deterministic demo implementations.
- Restaurant exports now include all 25 reviewed operational datasets,
  including finding feedback.

Evidence:

- `npm run typecheck`
- `npm test`: 282 passed
- `npm run security:backend`
- `npm run supabase:test`: 530 pgTAP assertions, quota concurrency proof, and
  no local security-advisor findings
- `npm run verify:private-beta-security:hosted`: passed without skipped checks
- Dedicated hosted feedback proof passed direct-DML, staff, cross-tenant,
  replay, changed-replay, evidence-poisoning, RLS, and audit assertions
- Hosted export returned all 25 datasets with exact counts and secret-free
  evidence
- Staging migrations applied through
  `20260728194253_harden_operational_finding_evidence.sql`
- Production was not changed

Known non-blocking findings:

- Supabase hosted advisors report existing intentional public RPC warnings
  plus staging leaked-password protection disabled; no advisor error was
  reported. These warnings remain staging/production configuration review
  items rather than an exception to RPC authorization tests.
- Cursor still needs to surface the daily brief, export interaction, and
  manager feedback controls on real devices.

### `private-beta-export-client-contract-16`

Delivered:

- A screen-facing `exportRestaurantData` method through the stable Mise service
  facade and repository contract.
- Hosted invocation of only the audited `export-restaurant-data` Edge boundary.
- Deterministic local-demo export using the same 25-dataset response shape and
  no live credentials.
- A second client validation boundary for schema version, serialized size,
  restaurant/team identity, dataset presence, exact counts, per-dataset row
  limits, protected provider keys, and retention statements.
- Expo SDK-matched file-system and sharing modules for the native UI handoff.

Evidence:

- Cross-tenant, incomplete, and protected-key payloads fail before reaching a
  screen.
- `npm run typecheck`
- `npm test`: 277 passed
- `npm run security:backend`
- `npm audit`: zero vulnerabilities
- Expo Doctor: 21/21

Remaining handoff:

- Cursor implements owner/admin file generation and sharing from Settings using
  only the stable service facade. The bounded instructions are recorded in
  `docs/launch/CURSOR_HANDOFF.md`.

### `private-beta-rendered-race-harness-15`

Delivered:

- A 15-second bound on every Chrome debugging connection and command.
- Deterministic rejection and timer cleanup for every pending command when the
  browser connection closes.
- Preserved 20-second request interception and 30-second rendered-state bounds.
- Static coverage requiring all seven route and mutation race labels plus child
  process and temporary-profile cleanup.

Evidence:

- The independent rendered staging suite passed Today, inventory list,
  inventory detail, Insights, Settings, order detail, and order mutation
  workspace-switch races, then exited cleanly.
- The complete hosted private-beta security suite passed without skipped checks,
  including tenant/workflow authority, service-RPC binding, all-Edge
  concurrency/forgery/rate limits, and the restaurant export proof.
- `npm run typecheck`
- `npm test`: 274 passed
- `npm run security:backend`

Remaining:

- Equivalent real-device switching and request-cancellation behavior remains
  part of the TestFlight walkthrough.

### `private-beta-daily-findings-contract-14`

Delivered:

- A typed beta finding contract with restaurant identity, category, severity,
  priority, bounded confidence, evidence references, affected workflow,
  recommended action, source window, generated time, freshness state,
  missing-data warnings, and policy version.
- A deterministic daily brief capped at 12 findings and five evidence
  references per finding, grouped by stable IDs into `Now`, `Up next`, and
  `Later`.
- Findings for pending inventory/order work, existing deterministic rule
  insights, missing daily sales, missing inventory setup, and unmapped sold menu
  items.
- Fail-closed tenant validation and one read-only repository snapshot. No model
  provider, inventory mutation, supplier draft, or send dependency exists.

Evidence:

- Fresh verified recommendation evidence receives bounded high confidence;
  stale evidence remains visible but cannot be labeled fresh.
- Missing daily sales, inventory, or mappings create explicit data-quality work.
- Reversed/noisy input produces the same bounded deterministic brief.
- Mixed-tenant input fails before any evidence reference can be emitted.
- `npm run typecheck`
- `npm test`: 271 passed
- `npm run security:backend`

Remaining handoff:

- Cursor surfaces the contract on Today/Insights with localized, scan-first
  sections. Append-only feedback for non-order findings is the next backend
  lifecycle gap.

### `private-beta-data-export-authority-13`

Delivered:

- An owner/admin-only `export-restaurant-data` Edge boundary using the standard
  authenticated firewall, role authorization, terminal event lifecycle, and
  bounded audit metadata.
- Twenty-four fixed operational datasets covering the restaurant profile, team,
  sales, immutable inventory history, recipes and mappings, supplier work,
  findings, setup metadata, provider connection status, and audit history.
- Deterministic pagination with per-dataset, total-row, and serialized-byte
  limits. Exports fail explicitly rather than returning partial data.
- A protected-key scanner and fixed public-schema allowlist that exclude Vault,
  OAuth credentials, private security logs, and provider secrets.
- Privacy copy that describes active-workspace retention, deletion-audit
  retention, credential exclusions, and the secure-support path for oversized
  exports.

Evidence:

- The firewall migration and function are active on dedicated staging only.
- The hosted proof returned all 24 tenant-A datasets with matching counts,
  denied a tenant-A manager, denied a tenant-B owner forging tenant A, found no
  protected keys, and recorded a content-free completion audit.
- `npm run typecheck`
- `npm test`: 264 passed
- `npm run security:backend`
- `npm run supabase:test`: 506 pgTAP assertions, quota concurrency proof, and no
  local advisor findings
- `npm run staging:restaurant-export-check`

Remaining handoff:

- Cursor adds a Settings export/download/share interaction for owners and
  admins after the Mac is unlocked. Real-device file sharing and the monitored
  privacy address remain release evidence.

### `private-beta-account-lifecycle-proof-12`

Delivered:

- A staging-only disposable lifecycle proof that provisions a new Auth user,
  creates a sole-owner restaurant with authoritative inventory evidence, invokes
  the production account-deletion boundary, and verifies exact cleanup.
- Durable post-auth recovery references in the Edge response and the hosted
  repository's operator-facing support error.
- Cross-tenant safety assertions covering stable sentinel fields and bounded
  restaurant and inventory-event counts.
- Exact failure cleanup limited to the generated email, restaurant ID, and
  staging-marker name.

Evidence:

- Hosted deletion audit
  `5a750618-e6d8-41de-b74b-0703e14d768f` reached
  `tenant_cleanup_completed`.
- The disposable Auth user and its sole-owner tenant were deleted; its one
  inventory event cascaded with the tenant; the sentinel tenant was unchanged.
- `npm run typecheck`
- `npm test`: 259 passed
- `npm run security:backend`
- `npm run staging:tenant-check`
- `npm run staging:service-rpc`
- `npm run staging:edge-concurrency`

Known finding:

- The rendered client-race harness completed six route races but did not exit
  with its final mutation-race result after an interrupted run. An exact fixture
  reseed restored deterministic staging state, and the direct hosted tenant,
  service-RPC, and Edge suites passed. Treat the rendered harness hang as a
  release-test infrastructure defect until rerun green.

### `private-beta-emergency-control-11`

Delivered:

- A service-role-only, replay-safe operational-mode transition RPC.
- Append-only private mode-change evidence with RLS and no client access.
- Database triggers that block authenticated inserts, updates, and deletes on
  every current public operational table in `read_only` or `emergency`.
- Normal mode preserves otherwise authorized restaurant operations;
  service-side recovery and account-deletion work remain available.
- A hosted proof that enters read-only inside a transaction, denies an
  authenticated inventory event, deduplicates a replay, and proves staging
  returned to `normal`.

Evidence:

- `npm run typecheck`
- `npm test`: 258 passed
- `npm run supabase:test`: 501 pgTAP assertions, quota concurrency, and no
  local security-advisor findings
- `npm run staging:emergency-mode-check`
- `npm run verify:private-beta-security:hosted`: passed without skipped checks
- Post-migration recovery: 44 tables and 443 rows matched
- Codex checkpoint: `6d4d18f`

Remaining:

- Every future public operational table must attach the mode-enforcement
  trigger in its creating migration.

### `private-beta-recovery-lifecycle-10`

In scope:

- Produce an encrypted-transport logical dump of staging operational schemas.
- Restore it into an ephemeral isolated PostgreSQL cluster that cannot resolve
  to staging or production.
- Verify every restored table using row counts and deterministic content
  digests without emitting row content.
- Record timing, artifact digest, object counts, cleanup, and remaining hosted
  recovery evidence.
- Document incident actions for tenant exposure, provider malfunction, bad
  recommendations, recovery, and emergency read-only mode.

Delivered:

- A TLS-only staging logical dump with staging identity and production-reference
  guards.
- An ephemeral loopback-only PostgreSQL restore that removes its cluster and
  dump after verification.
- One-session UTC-normalized counts and content digests for every restored
  operational table.
- Content-free recovery evidence with timing, size, object counts, and SHA-256.
- Incident procedures for tenant exposure, provider replay, bad
  recommendations, restoration, and emergency operating modes.

Evidence:

- `npm run recovery:staging-check`: 43 tables and 474 rows matched in 22 seconds
- Dump SHA-256:
  `0308331b18eb090a92c3733c086fe8895f32805624924ff83ca28f619e11da32`
- `npm run typecheck`
- `npm test`: 255 passed
- `npm run security:backend`
- Codex checkpoint: `63cd913`

Remaining external evidence:

- Managed Supabase Auth, Storage, Vault, and project-configuration recovery in
  a dedicated hosted recovery project.
- A named backup incident commander and communications owner.
- Approved retention and complete restaurant export policy.

### `private-beta-operations-observability-09`

In scope:

- Apply one bounded correlation contract to app and Edge telemetry.
- Sanitize the entire outgoing Sentry event, not only manually supplied extras.
- Bind every event to an environment and release without user contact data.
- Add a credentialed, fail-closed receipt-proof script for one controlled
  Sentry error and one scrubbed PostHog beta event.
- Document alert thresholds, ownership, escalation, and evidence recording.

Ownership:

- Codex owns the telemetry domain, app and Edge adapters, proof harness,
  operations documentation, and tests.
- Cursor has no files in this backend-only batch and must avoid the locked
  telemetry contracts until the checkpoint is recorded.

Delivered:

- A shared, bounded correlation contract for environment, release, operation,
  request, operation, restaurant, and authoritative event identities.
- Whole-event Sentry redaction that drops raw SDK user, request, breadcrumb,
  context, and message fields and rejects contact/credential values.
- Environment-specific EAS profile selection so preview cannot consume
  production observability or database configuration.
- Bounded Edge authorization/firewall error capture that never changes the
  operator response or blocks the workflow.
- A credentialed proof harness that sends and queries one controlled Sentry
  event and one scrubbed PostHog event.
- Monitoring ownership, thresholds, escalation, and evidence instructions.

Evidence:

- `npm run typecheck`
- `npm test`: 249 passed
- `npm audit --audit-level=high`: 0 vulnerabilities
- `npm run observability:check`: static contract passed
- `npm run security:backend`
- `npm run design:static`
- All seven staging Edge Functions refreshed with the shared telemetry code
- Hosted Edge tenant-forgery, role, concurrency, and rate-limit proof passed
  after deployment
- Codex checkpoint: `1d16169`

Remaining external activation evidence:

- Configure distinct staging Sentry and PostHog projects and run
  `MISE_OBSERVABILITY_LIVE=1 npm run observability:check`.
- Record provider event IDs, alert rule IDs, monitored support target, and a
  named backup owner.

### `private-beta-inventory-closure-08`

In scope:

- Repair the hosted rendered security race for the redesigned More navigation
  without reducing any tenant-switch assertion.
- Make count, receipt, waste, and stockout actions flow through the durable
  device outbox and server-authoritative inventory-event RPC.
- Keep `inventory_items.current_quantity` as a projection cache derived from
  accepted inventory events rather than a second client-controlled truth.
- Surface pending, accepted, retryable, rejected, and conflicting inventory
  evidence on the inventory detail workflow.
- Keep package items blocked until a manager verifies their canonical grams,
  milliliters, or each conversion.

Ownership:

- Codex: launch records, hosted verification harness, projection authority,
  repositories, validation, and backend tests.
- Cursor: inventory detail/list interaction, operation selection, outbox
  status, accessibility, and English/Spanish/Simplified Chinese copy.

Delivered:

- Server-authoritative inventory events now project native on-hand quantities
  from verified canonical grams, milliliters, or each conversions.
- Counts, receipts, waste, and stockouts use the durable device outbox and
  retain accepted, retryable, rejected, or conflicting evidence.
- Direct client inventory quantity mutation remains rejected.
- Whole-restaurant deletion preserves append-only history rules while allowing
  the intended tenant cascade.
- Demo behavior mirrors hosted projection and recommendation suppression.
- Inventory list and detail screens expose compact manager operations, queue
  state, role restrictions, and localized copy.

Evidence:

- `npm run typecheck`
- `npm test`: 247 passed
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:interactions`: passed at 390x844 in English, Spanish, and
  Simplified Chinese
- `npm run verify:private-beta-security:hosted`: all rendered tenant races,
  tenant/RPC boundaries, service authority, Edge forgery, roles, and rate
  limits passed without skipped checks
- `npm run staging:learning-check`: 14 service days and three 40 lb manager
  approvals moved the next bounded suggestion from 30 lb to 40 lb
- Cursor checkpoint: `debf9f1`
- Codex checkpoint: `d4dfd28`

Remaining external verification:

- Full Xcode and `simctl` are unavailable on the current Mac.
- Real-device offline recovery and TestFlight walkthrough remain required.

### `inventory-verification-sales-import-07`

Codex delivered:

- Canonical-unit authority fields on the shared inventory item type.
- Consistent normalization for hosted and local demo items.
- A guarded hosted verification adapter that calls only
  `verify_inventory_item_canonical_unit`.
- Demo verification with the same authority fields and audit semantics.
- Fail-closed normalization when a package item claims verification without a
  canonical unit.

Cursor delivered:

- A first-class daily CSV sales import route from Settings and POS setup.
- Live and demo persistence through the existing bounded sales-import path.
- Missing-restaurant, empty-file, and rejected-row operator feedback.
- Complete English, Spanish, and Simplified Chinese catalog coverage.

Evidence:

- `npm run typecheck`
- `npm test`: 242 passed
- `npm run security:backend`
- Codex checkpoints: `85158d5`, `3cff0c1`
- Cursor checkpoints: `510a68a`, `3581375`

Remaining:

- Hosted-staging verification-RPC proof.
- Receiving and package-conversion UI.

### `inventory-canonical-authority-06`

Delivered:

- Canonical-unit authority fields and verification state on every inventory
  item.
- Deterministic normalization of standard mass, volume, and count units while
  leaving cases, packs, and other item-specific units in draft.
- An inventory-event trigger that rejects unverified items and unit mismatches
  before append-only history is created.
- A manager-authorized, tenant-scoped canonical-unit verification RPC with an
  audit record.
- Automatic invalidation and re-normalization when an inventory item's display
  unit changes.

Evidence:

- `npm run typecheck`
- `npm test`: 236 passed
- `npm run security:backend`
- `npm run supabase:test`: 481 pgTAP assertions
- Concurrent workspace quota proof: 5 accepted, 15 rejected, 5 immutable
- Supabase advisors: no issues
- Migration list confirmed local schema history through `20260726233159`

Remaining external verification:

- Apply and execute verification/event paths on hosted staging.
- Add the typed client verification adapter and receiving package-conversion
  interface.

### `inventory-operation-input-05`

Delivered:

- A screen-safe operator command that accepts only receipt, count, waste, and
  stockout actions.
- Canonical grams, milliliters, and each validation with bounded quantities,
  timestamps, references, reason codes, and notes.
- Fixed evidence sources and allowlisted note metadata; screens cannot provide
  actor, sequence, correction links, or arbitrary metadata.
- One-time device client-event creation with an idempotency key derived from
  that immutable identity before durable queueing.

Evidence:

- `npm run typecheck`
- `npm test`: 233 passed
- `npm run security:backend`

Remaining:

- Enforce an inventory item's canonical unit at the database boundary.
- Cursor receiving/count/waste UI and mobile verification.

### `inventory-hosted-submission-04`

In scope:

- Flush the serialized device outbox through the active Mise repository without
  exposing provider details to Expo screens.
- Use only the manager-authorized `record_inventory_event` RPC in hosted mode.
- Preserve deterministic, idempotent behavior in local demo mode.
- Separate deterministic database conflicts from retryable transport failures.

Delivered:

- A strict PostgREST-to-domain normalizer for server-authoritative events.
- Stable RPC arguments that preserve the device-generated client event and
  idempotency identities.
- Screen-safe `flushQueuedInventoryEvents` orchestration with durable retry
  behavior.
- Deterministic in-memory demo authority and exact-replay deduplication.
- Static verification that the hosted adapter cannot directly mutate
  `inventory_events`.

Evidence:

- `npm run typecheck`
- `npm test`: 226 passed
- `npm run security:backend`
- Supabase RPC and database-function security guidance reviewed against the
  current July 2026 platform documentation and changelog.

Remaining external verification:

- Execute the new repository adapter against hosted staging.
- Wire receiving/count/waste screens after an explicit Cursor handoff.

### `inventory-outbox-device-03`

In scope:

- Serialize device outbox reads and writes so concurrent counts or receiving
  actions cannot drop each other.
- Bind the repository to AsyncStorage behind a screen-safe application API.
- Keep provider submission and Supabase details out of Expo screens.

Delivered:

- AsyncStorage-backed, restaurant-scoped inventory outbox.
- Serialized read-modify-write operations so concurrent offline events cannot
  overwrite each other.
- Stable `miseService` exports to queue and inspect pending device events.

Evidence:

- `npm run typecheck`
- `npm test`: 218 passed

### `private-beta-account-inventory-replay-02`

In scope:

- Codex: deterministic offline inventory outbox transitions, retry policy,
  authoritative deduplication, conflict surfacing, count reconciliation, and
  domain tests.
- Cursor: account deletion, restaurant team directory, invitations, session
  UX, and the related repository contracts.

Stop conditions:

- A retry changes `client_event_id` or `idempotency_key`.
- A conflict is silently retried or overwritten.
- Reconciliation mixes restaurants or inventory items.
- Account deletion bypasses the standard firewall, authorization, or audit
  lifecycle.

Delivered:

- Self-serve sign-up, account-deletion initiation, restaurant team directory,
  role controls, and localized settings UI.
- Recoverable two-phase account deletion: durable plan, Auth deletion, then
  service-retryable tenant cleanup by audit ID.
- Ownership-safe deletion candidates that preserve a restaurant when another
  active owner remains or is added after planning.
- Append-only inventory actor anonymization during Auth deletion without
  allowing direct event updates or deletes.
- A durable tenant-scoped device outbox, bounded retries, server
  deduplication, terminal conflict surfacing, and count reconciliation.

Evidence:

- `npm run typecheck`
- `npm test`: 216 passed
- `npm run security:backend`
- `npm run supabase:test`: 464 pgTAP assertions, concurrency proof, and no
  local security-advisor findings
- Cursor account/team checkpoint: `40aed3e`
- Tandem recovery and inventory-replay checkpoint: `c82ecf4`

Remaining external verification:

- Hosted-staging account deletion and tenant proof
- Real-device sign-up, team, deletion, and offline-replay walkthrough

### `operational-data-foundation-01`

Delivered:

- Canonical grams, milliliters, and each conversion with verified pack and
  density rules.
- Effective-dated POS, menu, recipe, ingredient, modifier, substitution, and
  supplier mapping contracts.
- Sales-volume mapping coverage gates at 90% for shadow mode and 95% for
  operational drafting.
- Global and restaurant-level provider kill switches.
- Append-only, tenant-safe inventory events with manager RPC authority,
  idempotent offline replay, correction links, immutable history, and audit
  evidence.

Evidence:

- TypeScript passed on the isolated Codex batch.
- 188 application/domain tests passed in the combined worktree.
- 439 local pgTAP tests passed after a clean migration rebuild.
- Supabase security advisors reported no issues.

Cross-batch findings handed to Cursor:

- The in-progress team-directory repository imports currently block combined
  worktree typechecking.
- The in-progress delete-account Edge Function still needs the standard
  firewall reservation before combined backend security checks can pass.

## Handoff format

Every completed batch records:

1. The exact paths changed.
2. Commands run and their results.
3. External verification that remains outstanding.
4. Known non-blocking findings.
5. The local checkpoint commit.
