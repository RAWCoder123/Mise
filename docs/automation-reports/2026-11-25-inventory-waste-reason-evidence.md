# Inventory waste reason evidence authority

Date: 2026-11-25  
Baseline: `origin/main` @ `78da7376`  
Branch: `cursor/mise-waste-reason-evidence-main`

## Gap

`public.record_inventory_event` accepted `waste` for owner/admin/manager with an
optional free-form `reason_code`. Projection subtracts waste from on-hand. A
manager JWT could therefore mint waste with a missing reason, a case variant, or
an unrelated taxonomy (for example `prep` / `demo_closeout`), rewrite on-hand,
and leave waste analysis without a comparable audit category.

## Change

- Domain: `inventoryWasteEvidence.ts` allowlist matches product writers
  (#301 / #1098): `spoilage | prep_trim | overproduction | dropped_broken |
  expired | other`. `acceptInventoryEvent` rejects `waste_requires_reason` /
  `invalid_waste_reason`. Notes stay optional.
- Additive BEFORE INSERT trigger
  `private.enforce_inventory_waste_reason_evidence` with the same rule.
- NOT VALID CHECK skips legacy rows; new inserts still fail closed via the
  trigger.
- Transport maps hosted `22023` messages ahead of the generic evidence matcher.
- pgTAP plan=8 from assertion call sites: bare/bad/case rejects, allowlisted
  accept, non-waste unconstrained, direct-insert reject.

## Alone-OK

Orthogonal to waste-source allowlist (#1265), usage/adjustment evidence (#396),
UI reason pickers (#301 / #1098 / #366), stockout reasons, count/correction
stacks, and purchase-line #1238/#1250–#1258. Does not touch
`app/inventory/[id].tsx`, `i18n/catalog.ts`, or `miseValidation.ts`.

## Verification

- `npm run typecheck` — passed
- focused waste-evidence + deliveryHistory suite — 12/12 passed
- `npm test` — 684 passed / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run supabase:test` — not run in this environment
