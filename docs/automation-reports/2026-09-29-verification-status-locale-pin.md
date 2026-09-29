# MISE-005CG: pin verification_status CHECKs to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-verification-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace bare-IN verification_status allowlists with the exact-token vocabulary
plus ASCII shape under COLLATE `"C"` on:

- `public.pos_catalog_item_mappings.verification_status`
- `public.recipe_ingredients.verification_status`
- `public.modifier_recipe_adjustments.verification_status`
- `public.ingredient_substitutions.verification_status`
- `public.supplier_items.verification_status`
- `public.inventory_items.canonical_unit_verification_status`

```sql
verification_status in ('draft', 'verified', 'rejected', 'expired')
and verification_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

(`inventory_items` uses the same allowlist and shape on
`canonical_unit_verification_status`.)

## Writer vocabulary

Confirmed ASCII mint:

- `draft` — unverified / provisional mapping or conversion
- `verified` — operator-confirmed authority
- `rejected` — explicitly refused mapping or conversion
- `expired` — formerly verified, no longer current

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover mapping
identity (#467), modifier `external_modifier_id` (#468),
`inventory_items.canonical_unit` (#490), sibling `canonical_unit` (#491), and
`inventory_events.event_type` (#492), but leave these verification_status CHECKs
on bare IN only. Without a dedicated COLLATE C shape CHECK, dump/restore under
LC_CTYPE drift can accept review-state bytes the restored C-locale path would
refuse — or the reverse — breaking mapping, recipe, substitution, supplier-pack,
and canonical-unit authority continuity across restore.

## Scope

- CHECK-only on the six review-state constraints above
- Does **not** rewrite mapping-review / verify / sync / recipe writers
- Does **not** touch mapping identity (#467), modifier identity (#468),
  inventory_items.canonical_unit (#490), sibling canonical_unit (#491), or
  inventory_events.event_type (#492)
- Does **not** touch `recipe_versions.status` (different vocabulary)
- Alone on main OK; timestamp after #492 (`20260929190000`)

## Verification

- `npm run typecheck`
- focused `tests/verificationStatusLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; Docker/hosted pgTAP not run here

## Files

- `supabase/migrations/20260929190000_mise_005cg_verification_status_locale_pin.sql`
- `supabase/tests/database/verification_status_locale_pin.test.sql`
- `tests/verificationStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-verification-status-locale-pin.md`
