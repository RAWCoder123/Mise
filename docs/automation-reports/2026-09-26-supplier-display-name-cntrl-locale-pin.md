# MISE-005V: create/rename supplier display_name cntrl locale pin

**Date:** 2026-09-26  
**Branch:** `cursor/mise-supplier-display-name-cntrl-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Change

Additive migration `20260926160000_mise_005v_supplier_display_name_cntrl_locale_pin.sql` rewrites `public.create_supplier` and `public.rename_supplier` so the display_name control-character preflight uses:

```sql
coalesce(p_display_name, '') collate "C" ~ '[[:cntrl:]]'
```

Pinned sites:

- `create_supplier` `coalesce(p_display_name, '')`
- `rename_supplier` `coalesce(p_display_name, '')`

## Why

MISE-005A proved locale drift on this cluster. MISE-005B pinned `suppliers_display_name_check` and normalize helpers to COLLATE C, but the authenticated create/rename mutators still used bare `[[:cntrl:]]`. Drift could accept display_name bytes a restored C-locale CHECK would reject (or refuse ones it would accept), breaking supplier create/rename continuity after restore.

## Out of scope

- Does not reattach `suppliers_display_name_check` (MISE-005B)
- Does not rewrite `private.normalize_supplier_display_name` / `normalize_supplier_name`
- Does not rewrite `save_restaurant_setup` supplier discovery preflights
- Preserves revoke + grant EXECUTE to authenticated only

## Compose

Must apply after MISE-003C durable supplier identity. Prefer after MISE-005B (#410) so CHECK + mutator pins land together. Compose-safe alone on main; create/rename have not been replaced since 003c.

## Verification

- Static tests in `tests/supplierDisplayNameCntrlLocalePin.test.ts`
- pgTAP fixture committed (not executed here without Docker)
