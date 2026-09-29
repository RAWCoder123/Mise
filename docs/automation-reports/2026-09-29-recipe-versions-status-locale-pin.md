# MISE-005CH: pin recipe_versions.status CHECK to COLLATE C

Date: 2026-09-29
Branch: `cursor/mise-recipe-versions-status-locale-pin`
Base: `origin/main` @ `78da737`

## Change

Replace the bare-IN `recipe_versions.status` allowlist with the exact-token
vocabulary plus ASCII shape under COLLATE `"C"`:

```sql
status in ('draft', 'verified', 'retired')
and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
```

## Writer vocabulary

Confirmed ASCII mint:

- `draft` — provisional recipe version, not yet operator-verified
- `verified` — operator-confirmed recipe authority for depletion
- `retired` — formerly active version, excluded from active windows

Exact-token allowlist is preserved; this tip adds the COLLATE C ASCII shape
gate alongside it.

## Why

MISE-005A proved locale drift on this cluster. Open sibling pins cover
verification_status (#493), inventory_events.event_type (#492), sibling
canonical_unit (#491), and inventory_items.canonical_unit (#490), but leave
`recipe_versions.status` on bare IN only. Without a dedicated COLLATE C shape
CHECK, dump/restore under LC_CTYPE drift can accept lifecycle-state bytes the
restored C-locale path would refuse — or the reverse — breaking recipe
authority continuity across restore.

## Scope

- CHECK-only on `public.recipe_versions.status`
- Does **not** rewrite recipe writers or the overlapping-window exclusion
- Does **not** touch verification_status (#493), inventory_events.event_type
  (#492), or canonical_unit pins (#490/#491)
- Alone on main OK; timestamp after #493 (`20260929200000`)

## Verification

- `npm run typecheck`
- focused `tests/recipeVersionsStatusLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan 11 from 11 assertion call sites); Docker/hosted
  pgTAP not run here

## Files

- `supabase/migrations/20260929200000_mise_005ch_recipe_versions_status_locale_pin.sql`
- `supabase/tests/database/recipe_versions_status_locale_pin.test.sql`
- `tests/recipeVersionsStatusLocalePin.test.ts`
- `docs/automation-reports/2026-09-29-recipe-versions-status-locale-pin.md`
