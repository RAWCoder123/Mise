# MISE-005CD: pin inventory / purchase_decision canonical_unit to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-canonical-unit-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace bare-IN `canonical_unit` CHECKs on `public.inventory_items` and
`public.purchase_decision_events` with the exact-token allowlist plus ASCII
shape under COLLATE `"C"`, and mirror the same gate in
`public.verify_inventory_item_canonical_unit`:

```sql
-- inventory_items (null remains legal for draft items)
canonical_unit is null
or (
  canonical_unit in ('g', 'ml', 'each')
  and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
)

-- purchase_decision_events
canonical_unit in ('g', 'ml', 'each')
and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

Writer gate:

```sql
p_canonical_unit is null
or p_canonical_unit not in ('g', 'ml', 'each')
or p_canonical_unit collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `g` — mass
- `ml` — volume
- `each` — count

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it. Inventory draft rows may still store `NULL`.

## Why

MISE-005A proved locale drift on this cluster. Later 005* tips pinned
machine-identity and provenance allowlists under COLLATE C, but left these
bare-IN `canonical_unit` CHECKs and the verify writer gate unpinned. Without a
dedicated COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
conversion-identity bytes the restored C-locale path would refuse — or the
reverse — breaking inventory conversion and purchase-decision evidence
continuity across restore.

## Scope

- CHECK replace on `inventory_items_canonical_unit_check`
- CHECK replace on `purchase_decision_events_canonical_unit_check`
- Writer rewrite of `verify_inventory_item_canonical_unit` only
- Does **not** rewrite `record_purchase_decision_*` writers
- Does **not** touch sibling `canonical_unit` CHECKs on `inventory_events`,
  `recipe_ingredients`, `supplier_items`, `supplier_delivery_items`,
  `modifier_recipe_adjustments`, or `ingredient_substitutions`
- Does **not** touch `recommendation_unit` (#416) or `evidence_version` (#482)
- Alone on main OK; timestamp after #489 (`20260929160000`)

## Verification

- `npm run typecheck`
- focused `tests/canonicalUnitLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 18 from 18 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929160000_mise_005cd_canonical_unit_locale_pin.sql`
- `supabase/tests/database/canonical_unit_locale_pin.test.sql`
- `tests/canonicalUnitLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-canonical-unit-locale-pin.md`
