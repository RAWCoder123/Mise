# Mise implementation state

Status: **CURRENT**

Last verified: 2026-08-24

## Authoritative baseline

`origin/main` is the sole authoritative implementation baseline for Mise. The
MISE-003C work starts from the merged MISE-003B baseline:

```text
bc5a8d06c8bdb6aab77c4a1244ea0275517ebd84
```

MISE-001, MISE-002A, MISE-002B, MISE-003A, and MISE-003B are locked complete.
Their historical branches remain evidence only and must not be resumed or
merged wholesale.

## Current verdict

Mise remains a **controlled-pilot/private-beta codebase**. The locked milestones
establish count-time-anchored inventory authority, exact provider identity and
mapping, serialized review, current purchase-approval authority, and exact
supplier-send content/claim/completion integrity.

MISE-003C is limited to replacing mutable supplier-name authority with durable,
tenant-scoped supplier identity. It does not add a supplier marketplace,
procurement network, catalog, pricing, payments, EDI, logistics, or Restaurant
Operating Memory.

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

## Exact current-main verification baseline

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
- `npm test`: 605 tests total, 604 passed, 1 failed. The sole failure is the
  exact inherited hosted provider-mapping assertion (`actual 0`, `expected 2`),
  now at `tests/applicationProviderMappings.test.ts:302`. All six added tests
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
- `durable_supplier_identity.test.sql`: 66/66 assertions passed.
- `npm run supabase:test`: exited 1 after the database proof actually ran. Each
  of three pgTAP attempts ran 28 files and 1,082 tests. The only failures are
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

## Next milestone gate

MISE-003C may be proposed for merge only after the durable-supplier migration,
application contracts, demo behavior, UI mutations, RLS/direct-DML controls,
fingerprint parity, and required concurrency proofs pass with no new failure
relative to the exact current-main baseline. Do not begin MISE-004 or Restaurant
Operating Memory as part of this milestone.

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
