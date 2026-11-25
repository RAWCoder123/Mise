# Inventory stockout reason evidence authority

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-stockout-reason-evidence-main`

## Gap

`public.record_inventory_event` accepted `stockout` for owner/admin/manager with an
optional free-form `reason_code`. Projection sets on-hand to zero. A
manager JWT could therefore mint stockout with a missing reason, a case variant, or
an unrelated taxonomy (for example `ran_out` / `demo_closeout`), rewrite on-hand,
and leave coverage learning without a comparable audit category.

## Change

- Domain: `inventoryStockoutEvidence.ts` allowlist matches product writer
  (#366): `under_ordered | unexpected_demand | delivery_missed | spoilage_cleared |
  theft_loss | other`. `acceptInventoryEvent` rejects `stockout_requires_reason` /
  `invalid_stockout_reason`. Notes stay optional.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_stockout_reason_evidence` with the same rule.
- NOT VALID CHECK skips legacy rows; new inserts still fail closed via the
  trigger.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=8 from assertion call sites: bare/bad/case rejects, allowlisted
  accept, non-stockout unconstrained, direct-insert reject.

## Alone-OK

Orthogonal to stockout-source allowlist (#1266), usage/adjustment evidence (#396),
UI reason pickers (#366), waste reason evidence (#1270) on the domain/DB shape,
count/correction stacks, and purchase-line #1238/#1250–#1258. Does not touch
`app/inventory/[id].tsx`, `i18n/catalog.ts`, or `miseValidation.ts`.

Contested merge note: if #1270's cross-type domain test still accepts bare
stockout under the waste-reason suite, rebase that assertion after both land so
stockout continues to prove it is unconstrained by the *waste* taxonomy while
carrying its own allowlisted reason.

## Verification

- `npm run typecheck` — passed
- focused stockout-evidence suite — 8/8 passed
- `npm test` — 684 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
