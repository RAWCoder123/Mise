# MISE-005CE: pin sibling canonical_unit CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-sibling-canonical-unit-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace bare-IN `canonical_unit` CHECKs on six sibling conversion-identity
tables with the exact-token allowlist plus ASCII shape under COLLATE `"C"`:

```sql
-- NOT NULL tables (inventory_events, recipe_ingredients,
-- modifier_recipe_adjustments, ingredient_substitutions,
-- supplier_delivery_items)
canonical_unit in ('g', 'ml', 'each')
and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'

-- supplier_items (null remains legal for draft packs)
canonical_unit is null
or (
  canonical_unit in ('g', 'ml', 'each')
  and canonical_unit collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
)
```

## Writer vocabulary

Confirmed ASCII mint:

- `g` — mass
- `ml` — volume
- `each` — count

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it. Supplier-item draft rows may still store `NULL`.

## Why

MISE-005A proved locale drift on this cluster. MISE-005CD (#490) pinned
`inventory_items` / `purchase_decision_events` and the verify writer, but left
these sibling bare-IN `canonical_unit` CHECKs unpinned. Without a dedicated
COLLATE C shape CHECK, dump/restore under LC_CTYPE drift can accept
conversion-identity bytes the restored C-locale path would refuse — or the
reverse — breaking inventory event, recipe, substitution, supplier-pack, and
delivery conversion continuity across restore.

## Scope

- CHECK replace on `inventory_events_canonical_unit_check`
- CHECK replace on `recipe_ingredients_canonical_unit_check`
- CHECK replace on `modifier_recipe_adjustments_canonical_unit_check`
- CHECK replace on `ingredient_substitutions_canonical_unit_check`
- CHECK replace on `supplier_items_canonical_unit_check` (null-or preserved)
- CHECK replace on `supplier_delivery_items_canonical_unit_check`
- Does **not** rewrite inventory event / delivery / recipe writers
- Does **not** touch `inventory_items` / `purchase_decision_events` (#490)
- Does **not** touch inventory_events identity (#478) or modifier id (#468)
- Alone on main OK; timestamp after #490 (`20260929170000`)

## Verification

- `npm run typecheck`
- focused `tests/siblingCanonicalUnitLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 27 from 27 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929170000_mise_005ce_sibling_canonical_unit_locale_pin.sql`
- `supabase/tests/database/sibling_canonical_unit_locale_pin.test.sql`
- `tests/siblingCanonicalUnitLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-sibling-canonical-unit-locale-pin.md`
