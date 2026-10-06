# MISE-005IO: pos_sales.source_pos cntrl locale pin

Date: 2026-10-06  
Branch: `cursor/mise-pos-sales-source-pos-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.pos_sales.source_pos` remained foundation-unbound (`text not null
default 'Demo POS'`) with no length or control-character CHECK. Sibling tip
MISE-005BL (#472) pinned `source_record_id` on the same
`UNIQUE (restaurant_id, source_pos, source_record_id)` sale-identity key;
MISE-005I (#417) pinned provider identity columns. Under ctype drift,
dump/restore can disagree with those sibling gates on the provider-label half
of sale identity.

## Fix

Additive migration
`20261006160000_mise_005io_pos_sales_source_pos_cntrl_locale_pin.sql`
attaches `pos_sales_source_pos_check`:

```sql
pg_catalog.length(pg_catalog.btrim(source_pos)) between 1 and 80
and source_pos collate "C" !~ '[[:cntrl:]]'
```

Length class matches `inventory_events.source`; known writers use short fixed
labels (`Square`, `Demo POS`, `Manual CSV Upload`).

## Out of scope

- Does not rewrite Square sync, `save_restaurant_setup`, or prepare writers
- Does not rewrite `source_record_id` (#472) or provider-identity CHECKs (#417)
- Does not touch item_name/category tips or inventory_events

## Compose

Alone-OK on main versus #472/#417/#591/#594. Timestamp after MISE-005IN (#656).

## Verification

- `npm run typecheck`
- focused `tests/posSalesSourcePosCntrlLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (plan=8 from 8 assertion call sites); not executed
  here when Docker unavailable
