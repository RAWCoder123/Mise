# Mise implementation state

Status: **CURRENT**

Last verified: 2026-08-24

## Authoritative baseline

`origin/main` is the sole authoritative implementation baseline for Mise. The
MISE-004A work starts from the exact merged MISE-003C baseline:

```text
2aa2ac167ec1fef43553b925e09b0d7d7b5cee03
```

MISE-001, MISE-002A, MISE-002B, MISE-003A, MISE-003B, and MISE-003C are locked complete.
Their historical branches remain evidence only and must not be resumed or
merged wholesale.

## Current verdict

Mise remains a **controlled-pilot/private-beta codebase**. The locked milestones
establish count-time-anchored inventory authority, exact provider identity and
mapping, serialized review, current purchase-approval authority, and exact
supplier-send content/claim/completion integrity.

MISE-004A is limited to factual purchase-decision evidence and deterministic,
read-only pattern summaries. It does not alter recommendation quantities,
purchase authority, supplier-send authority, or autonomy. It does not add an
LLM memory layer, embeddings, a vector store, or generic Restaurant Operating
Memory.

## MISE-004A purchase decision memory

Every applied explicit decision on a Mise-generated purchase recommendation is
recorded in the same transaction as the mature MISE-003A/003C workflow. The
append-only `public.purchase_decision_events` ledger distinguishes exact
approval, approval with quantity override, dismissal, undo, and explicit
exclusion from pattern learning. Manual recommendations retain their existing
semantics and do not create system-recommendation learning evidence.

Each base event preserves the exact suggested and chosen purchase-unit
quantities, the verified action-time canonical conversion and canonical
quantities, distinct raw and canonical deltas, inventory item ID, durable supplier ID, recommendation source,
planning revision, actor and role, exact applied audit identity, and a bounded
allowlist of purchase-authority context. It never copies operator notes, order
messages, email content, provider payloads, or other unbounded data. Undo and
exclusion append a reference to the event they compensate; history is never
rewritten or deleted.

Patterns use the versioned deterministic policy `mise.purchase_pattern.v1`.
Comparable active evidence is grouped by restaurant, inventory item, durable
supplier ID, canonical unit, recommendation source, and evidence version.
Patterns are computed on read from committed events, so there is no derived
cache or rebuild race. Five active comparable events are required for
eligibility. Evidence is `established` only when one factual outcome bucket has
at least 80% agreement; contradictory eligible evidence remains `emerging` and
is labeled `mixed`. Supplier reassignment or canonical-unit change makes the
old pattern non-current; a supplier display-name rename does not.

The Orders UI shows only eligible, current-context factual summaries in EN, ES,
and ZH. It does not prefill, change, rank, approve, suppress, or otherwise feed
patterns back into recommendations in MISE-004A. Raw actor-level events have no
authenticated Data API read or write grant. Tenant members receive only the
bounded aggregate RPC; exclusion requires owner, admin, or manager authority.

No historical backfill is attempted. Existing audits do not contain every
action-time canonical and context field required by `mise.purchase_decision.v1`,
so inventing legacy evidence would violate the evidence contract. Collection
starts forward when MISE-004A is deployed.

## MISE-004C purchase line ledger

This work was originally issued under the MISE-004A label, which was already
taken by the purchase decision memory above. It was renamed to MISE-004C before
merge: 004A and 004B were both claimed, and two milestones sharing an ID would
make every later prompt, PR reference, and lookup here ambiguous. The two share
no tables. It lives in
`supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql`.

`public.purchase_lines` is the canonical append-only record of every item a
restaurant has purchased. Each line stores the MISE-003C durable supplier
reference where one exists, the raw item description exactly as it appeared on
the source document, a deterministic `normalized_item_key`, quantity, unit of
measure, pack size, unit and extended price with currency, transaction and
received dates, the source (`invoice`, `order_confirmation`, `manual_entry`),
the source document reference, a correlation ID, and a per-line
`parse_confidence` of `confirmed`, `estimated`, or `could_not_verify`.

Normalization is deterministic string work under
`mise.purchase_line_normalization.v1`: lowercase, trim, collapse whitespace,
lift pack/size tokens into their own field against a fixed unit vocabulary,
then strip punctuation from what remains. There is no AI, no fuzzy matching, no
stemming, and no clustering. Two spellings a human would call the same item stay
distinct keys. The identical rules are implemented in SQL and in
`services/domain/purchaseLines.ts`; `tests/purchaseLineLedgerMigration.test.ts`
fails if the two vocabularies drift.

Writes are server-authoritative. `public.ingest_purchase_lines` and
`public.supersede_purchase_line` are the only write paths, both SECURITY DEFINER
with owner/admin/manager authority. Authenticated clients hold SELECT only,
under an RLS membership policy. A supplier belonging to another restaurant fails
closed rather than becoming unattributed.

Ingestion is idempotent on `(restaurant, supplier, source_document_reference,
line_index)`. A null supplier collapses to the nil UUID so documents from an
unnamed supplier still deduplicate. Re-ingesting a document records nothing new
and reports what was already on file. Two lines claiming one document position
are refused rather than silently collapsed.

History is append-only. A correction appends a new line at the next revision of
the same document position that references the line it supersedes; the corrected
line is never rewritten or removed. A line may be corrected at most once, so
correction chains stay linear. The update/delete trigger permits only the two
existing ledger escapes: a parent restaurant DELETE cascading tenant history
away, and the account-deletion path anonymizing an actor who no longer exists.

Parse failures are visible. Confidence is only ever lowered, never raised: a
line missing quantity, unit of measure, unit price, extended price, or a usable
normalized key is recorded as `could_not_verify`, and absent fields stay null
rather than defaulting to zero. Every ingestion emits one `purchase_lines_recorded`
activity record stating how many lines were recorded, how many were already on
file, and how many could not be verified, and raises attention when any line
could not be verified.

## Credits and returns on the purchase line ledger

A credit is a stated direction, never a negative number. `line_type` is
`purchase` or `credit`, is NOT NULL with no default, and every writer states it.
Quantity, unit price, and extended price stay non-negative magnitudes, so a
flipped sign remains a parse error and the internal-consistency rules need no
sign convention: they apply to credits unchanged, and a credit can be
internally inconsistent exactly like an invoice line.

`credit_memo` joins the source vocabulary. A credit memo is its own document, so
it occupies its own idempotency space and never disturbs the invoice it offsets.
A credit never supersedes anything: a correction says the record was wrong, a
credit says the record was right and money came back, so the original line stays
current.

`credits_line_id` is nullable and is set only when the source document itself
names the original line. Mise never infers it. A stated link is validated
server-side against the same tenant and supplier and fails closed otherwise.
Several partial credits may reference one line, so unlike supersession the link
carries no uniqueness. Unmatched credits are ordinary and fully recordable, and
linkage never affects confidence.

`signed_quantity` and `signed_extended_price` are stored generated columns, so
net quantity and net spend are a plain aggregate rather than reconstructed
application logic. `public.list_purchase_line_net_by_item` groups current,
non-superseded lines by restaurant, supplier, normalized item key, unit of
measure, and currency; it never nets across any of those.

**Known limitation.** Netting depends on `normalized_item_key` agreement across
documents, and that key is only as stable as the wording each document used. A
credit memo that describes an item differently from the invoice forms its own
group and will not net against it. MISE-004C forbids fuzzy matching, stemming,
and clustering, so this cannot be resolved at this stage and is not papered
over: a group holding credits with no purchase behind it is returned with
`unmatched_credit` set, so an unnetted credit is visible as an unmatched credit
rather than disappearing into a silently wrong net.

This ledger predicts nothing. It does not reorder, infer depletion, model
recipes, match items across suppliers, or aggregate across restaurants. It reads
and writes no MISE-003 purchasing table. It is substrate for later work only.

## MISE-003C durable supplier invariant

A supplier display name may change; its authority identity must not. New
authoritative purchasing and supplier-delivery paths resolve, group, validate,
serialize, and lock by the stable pair:

```text
restaurant_id + supplier_id
```

Supplier names are presentation or historical snapshot data. They are not an
authority fallback.

The MISE-003C candidate introduces `public.suppliers` as the tenant-scoped
identity registry. Each supplier has a stable UUID, `restaurant_id`, bounded
`display_name`, deterministic `normalized_name`, and timestamps. Exact
normalized-name equality is used only to discover an initial identity during
the one-time, same-restaurant backfill. It never merges suppliers across
restaurants and is not the ongoing authority key.

Durable `supplier_id` relationships cover the authority-bearing supplier
records, including:

- supplier recipients;
- inventory items used by purchasing;
- purchase recommendations;
- supplier orders;
- supplier items and purchase-order history where identity can be resolved;
- supplier-scoped autonomy configuration;
- new supplier-email delivery claims.

Tenant-safe relationships bind `(restaurant_id, supplier_id)` to
`suppliers(restaurant_id, id)`. Hosted mutations revalidate the supplier ID on
the server and fail closed when a required durable identity is absent or belongs
to another restaurant.

## Migration and backfill semantics

The additive MISE-003C migration derives initial suppliers from existing
supplier-bearing rows. Within one restaurant, exact deterministic normalized
names may share one initial supplier ID. Blank, null, control-character, or
otherwise malformed names do not establish authority. Duplicate candidates are
resolved deterministically inside the tenant, never across tenants.

Existing historical display names are not deleted. Historical records that
cannot be safely resolved remain readable and fail closed instead of acquiring
invented authority. Previously sent delivery evidence and fingerprints are not
rewritten to pretend they contained supplier IDs.

Legacy recipient rows that collapse to the same exact MISE-003C normalized
supplier identity are preflighted before durable recipient uniqueness is
created. Rows are deterministically deduplicated only when every normalized
email agrees; the retained and removed row IDs are migration-audited without
copying email addresses into audit metadata. Conflicting email authority aborts
with a controlled manual-reconciliation error before the unique-index step.

Supplier-name discovery in `save_restaurant_setup` is limited by the existing
server-owned `setup_completed` audit boundary. The audit insertion and setup RPC
share one restaurant setup advisory lock. After completion, an exact original
fingerprint is a no-op; every changed payload fails before name discovery or
inventory mutation. Later creation, rename, and reassignment must use their
dedicated durable-ID workflows. Demo mode mirrors the same completed-setup
boundary.

## Rename and reassignment semantics

A rename updates the supplier's display name while preserving its supplier ID,
recipient relationship, inventory relationship, recommendation identity, order
identity, and advisory-lock domain. Where the display name contributes to an
unsent email subject or body, the rename advances the send-content revision and
requires fresh MISE-003B content approval. It does not rewrite an immutable sent
or unresolved delivery claim.

Reassigning an inventory item from supplier S1 to supplier S2 is a different,
authority-changing operation. It revalidates both same-tenant IDs, invalidates
or blocks stale purchase authority as appropriate, and cannot silently reparent
approved or send-bound work. A stale S1 recommendation cannot be approved as S2.

## Order, recipient, and lock identity

Draft reuse and grouping use `supplier_id`, so similar or equal presentation
names cannot collapse distinct suppliers into one order. Recipient lookup uses
`restaurant_id + supplier_id`; renaming a supplier therefore does not detach its
configured email address. Supplier advisory locks use the same durable identity,
so a rename does not split the serialization boundary and different suppliers
remain independently concurrent.

Supplier-order names remain display snapshots for operator review and historical
readability. Identity-sensitive joins and mutations do not fall back to those
snapshots.

Supplier-delivery reliability memory also finishes with a durable
`restaurant_id + supplier_id` dedupe key. The pre-003C name-keyed implementation
is retained only as a revoked compatibility base. The active wrapper preserves
pre-existing name-keyed memories under an explicit legacy key, uses a
transaction-local adapter while the mature delivery workflow runs, and restores
the current row to its durable supplier-ID key before commit. Historical memory
evidence is not attributed to a newly discovered same-name supplier.

## Supplier-send content version

New canonical supplier-send snapshots use the deliberately versioned
`mise.supplier_send.v2` contract. The snapshot binds both:

- `supplierId` as authority identity; and
- `supplierName` as the exact operator-reviewed presentation.

The PostgreSQL hosted builder remains canonical. Demo TypeScript serialization
retains byte-for-byte parity for the same v2 snapshot. A rename can change the
reviewed content fingerprint without changing supplier authority. New claims
bind the durable supplier ID, while legacy v1 claims remain governed by their
original immutable evidence and may complete only under the existing fail-safe
MISE-003B rules.

## Intentionally retained supplier-name fields

Supplier-name fields are retained only where they serve one of these bounded
purposes:

- current display text in read models and UI;
- immutable or historical order/delivery snapshots;
- one-time migration and backfill discovery;
- operator search that resolves to a supplier ID before mutation.

They must not be used for purchase authority, draft reuse, recipient selection,
send claims, advisory locking, or cross-record identity matching.

## Historical MISE-003C starting baseline

The following results were recorded on the exact starting commit
`bc5a8d06c8bdb6aab77c4a1244ea0275517ebd84`, before MISE-003C changes. They are
baseline evidence, not final MISE-003C results.

- `npm run typecheck`: passed.
- `npm test`: failed with 599 tests total, 598 passed, and 1 failed. The failure
  is `tests/applicationProviderMappings.test.ts:293`, “hosted repository
  planning data preserves provider identity through the real application
  outlook path” (`actual 0`, `expected 2`).
- `npm run security:backend`: passed.
- `npm run security:static`: passed.
- `npm run design:static`: passed.
- `npm run qa:routes`: passed for 20 routes.
- `npm run qa:mobile-layout`: passed for 28 routes at 390x844 with
  `overflowX=0`.
- `npm run supabase:test`: exited 1. The database proof did execute with
  Supabase CLI 2.115.0; this was not an “unavailable” result.
- Existing direct inventory projection, POS mapping, purchase-approval,
  approval-vs-Square-sync, supplier-send concurrency, and fingerprint parity
  harnesses passed.
- pgTAP executed three times with the same result: 27 files and 1,016 tests per
  attempt. `inventory_count_sessions.test.sql` lacked
  `function_privs_are(unknown, unknown, text[], unknown)` and planned 6 tests but
  ran 4. `tenant_isolation.test.sql` failed assertion 117 because the actual
  allowlist included `inventory_count_lines` and `inventory_count_sessions`, and
  assertions 171 and 174 because the recommendation remained `pending` where
  `approved` was expected.
- The wrapper stopped at pgTAP, so its local-workspace concurrency phase and
  final advisor phase did not execute. A separately run
  `npx supabase db advisors --local --type security --fail-on error` passed with
  no issues.

## Final MISE-003C verification

The completed candidate was compared with the exact baseline above.

- `npm run typecheck`: passed.
- `npm test`: 606 tests total, 605 passed, 1 failed. The sole failure is the
  exact inherited hosted provider-mapping assertion (`actual 0`, `expected 2`),
  now at `tests/applicationProviderMappings.test.ts:302`. All seven added tests
  pass.
- `npm run security:backend`: passed.
- `npm run security:static`: passed.
- `npm run design:static`: passed.
- `npm run qa:routes`: passed for 20 routes.
- `npm run qa:mobile-layout`: passed for 27 current routes at 390x844 with zero
  horizontal overflow.
- All direct PostgreSQL harnesses passed: inventory projection, POS mapping,
  purchase approval, purchase approval vs Square sync, the seven MISE-003B
  supplier-send races, and the four MISE-003C supplier-identity races.
- Supplier-send v2 fingerprint parity passed for the adversarial snapshot and
  exact 65,536-byte body with byte-identical serialization and SHA-256.
- `durable_supplier_identity.test.sql`: 98/98 assertions passed, including
  same-email recipient deduplication, conflicting-email failure, tenant
  separation, initial setup, exact replay, rename followed by stale replay,
  post-setup creation/reassignment denial, and the shared completion lock.
- `npm run supabase:test`: exited 1 after the database proof actually ran. Each
  of three pgTAP attempts ran 28 files and 1,114 tests. The only failures are
  the exact inherited baseline identities: `inventory_count_sessions` planned
  6/runs 4 because `function_privs_are(unknown, unknown, text[], unknown)` is
  unavailable, plus `tenant_isolation` assertions 117, 171, and 174. Every
  MISE-003C database, MISE-003A authority, MISE-003B send-integrity, and ABA
  regression passed. No new database failure remains.
- The wrapper stops after the inherited pgTAP exit, so its later
  local-workspace/advisor phase does not run. The required separate
  `npx supabase db advisors --local --type security --fail-on error` completed
  and reported no issues.

The candidate therefore introduces no new gate failure relative to exact
current main.

## Exact MISE-004A current-main baseline

The MISE-004A comparison was recorded on exact starting commit
`2aa2ac167ec1fef43553b925e09b0d7d7b5cee03` before purchase-decision-memory
changes.

- `npm run typecheck`, `npm run security:backend`,
  `npm run security:static`, `npm run design:static`, `npm run qa:routes`, and
  `npm run qa:mobile-layout` passed. Route QA covered 20 routes; mobile QA
  covered 27 routes at 390x844 with `overflowX=0`.
- `npm test`: 606 tests total, 605 passed, and 1 failed. The sole failure was
  `tests/applicationProviderMappings.test.ts:302`, “hosted repository planning
  data preserves provider identity through the real application outlook path”
  (`actual 0`, `expected 2`).
- All existing direct PostgreSQL inventory-projection, POS-mapping,
  purchase-approval, approval-vs-Square-sync, supplier-send, and durable
  supplier-identity concurrency suites passed. Supplier-send v2 fingerprint
  parity also passed.
- `npm run supabase:test` executed the database proof and exited 1. Each of
  three pgTAP attempts ran 28 files and 1,114 tests with only the inherited
  failures: `inventory_count_sessions.test.sql` planned 6/runs 4 because
  `function_privs_are(unknown, unknown, text[], unknown)` is unavailable, plus
  `tenant_isolation.test.sql` assertions 117, 171, and 174.
- A separately run
  `npx supabase db advisors --local --type security --fail-on error` passed with
  no issues.

## Final MISE-004A verification

- `npm run typecheck`: passed.
- `npm test`: 621 tests total, 620 passed, and 1 failed. The sole failure is the
  exact inherited provider-mapping assertion at
  `tests/applicationProviderMappings.test.ts:302` (`actual 0`, `expected 2`).
  All 15 added TypeScript tests pass: 9 deterministic domain tests, 5 static
  authority/privacy/UI-boundary tests, and 1 demo integration test.
- `npm run security:backend`, `npm run security:static`, and
  `npm run design:static`: passed.
- `npm run qa:routes`: passed for 20 routes.
- `npm run qa:mobile-layout`: passed for 27 routes at 390x844 with
  `overflowX=0`.
- `purchase_decision_memory.test.sql`: 54/54 assertions passed, covering exact,
  override, dismissal, no-interaction, replay, undo, exclusion, atomic failure,
  thresholds, mixed evidence, identity changes, privacy, and tenant isolation.
- The MISE-004A direct PostgreSQL concurrency harness passed all 12 assertions:
  identical approval replay, approval/undo, approval/dismissal, committed
  visibility, and cross-tenant isolation. Every pre-existing direct concurrency
  suite and supplier-send fingerprint parity suite also passed.
- `npm run supabase:test` executed 29 pgTAP files and 1,168 tests per attempt.
  It exited 1 only for the unchanged inherited baseline failures:
  `inventory_count_sessions` planned 6/runs 4 because the pgTAP helper is
  unavailable, and `tenant_isolation` assertions 117, 171, and 174. All new
  MISE-004A proofs and every locked-milestone regression passed.
- The required separate
  `npx supabase db advisors --local --type security --fail-on error` passed with
  no issues.

MISE-004A therefore adds no gate failure relative to exact current main.

## Next milestone gate

MISE-004A may be proposed for merge only with append-only atomic evidence,
deterministic factual summaries, hosted/demo parity, privacy controls, and the
required concurrency proofs showing no new failure relative to exact current
main. Do not begin MISE-004B or any broader Restaurant Operating Memory work as
part of this milestone.

## Documentation authority

Current:

- `docs/implementation/STATE.md`
- `AGENTS.md`
- `docs/product/mise-operational-backend-master.md`
- `docs/pilot/`

Historical or superseded:

- `docs/implementation/DECISIONS.md`
- `docs/implementation/PR_INTEGRATION_PLAN.md`
- `docs/implementation/CLAUDE_HANDOFF.md`
- `docs/implementation/CLAUDE_CONSOLE_AGENT_PROMPT.md`
- `docs/implementation/AGENT_KIT_README.md`
