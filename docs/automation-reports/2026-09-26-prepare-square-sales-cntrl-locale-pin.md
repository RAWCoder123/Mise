# MISE-005U: prepare_square_sales_for_authority cntrl locale pin

**Date:** 2026-09-26  
**Branch:** `cursor/mise-prepare-square-sales-cntrl-locale-pin`  
**Base:** `origin/main` @ `78da737`

## Change

Additive migration `20260926150000_mise_005u_prepare_square_sales_cntrl_locale_pin.sql` rewrites `private.prepare_square_sales_for_authority` so every control-character preflight uses:

```sql
<expr> collate "C" ~ '[[:cntrl:]]'
```

Pinned sites:

- `sale_source_record_id`
- `item_name`
- `coalesce(incoming_location_id, '')`
- `coalesce(incoming_variation_id, '')`
- `coalesce(incoming_catalog_item_id, '')`
- `derived_catalog_item_id`

## Why

MISE-005A proved locale drift on this cluster. MISE-005I pinned `pos_sales` provider-identity CHECKs to COLLATE C, but the authority prepare helper still used bare `[[:cntrl:]]`. Drift could accept Square identity bytes a restored C-locale CHECK would reject (or refuse ones it would accept), breaking POS sale → recipe depletion continuity after restore.

## Out of scope

- Does not reattach `pos_sales` provider-identity CHECKs (MISE-005I)
- Does not rewrite `service_begin_square_authority_sync` / `service_apply_square_sync_result*` wrappers
- Preserves EXECUTE revoked from public/anon/authenticated/service_role (security invoker helper)

## Compose

Must apply after MISE-003A authority correction. Prefer after MISE-005I (#417) so CHECK + prepare pins land together. Compose-safe alone on main; no shared CHECK reattach with #417.

## Verification

- Static tests in `tests/prepareSquareSalesCntrlLocalePin.test.ts`
- pgTAP fixture committed (not executed here without Docker)
