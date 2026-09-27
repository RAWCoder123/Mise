# MISE-005AL: purchase_lines currency locale pin

Date: 2026-09-27  
Branch: `cursor/mise-purchase-line-currency-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.purchase_lines.currency` still accepted a bare class match:

```sql
currency is null or currency ~ '^[A-Z]{3}$'
```

MISE-005AB (#436) pins the same three-letter uppercase shape on
`public.restaurants.currency` with `COLLATE "C"`. The purchase-line ledger
column stayed unpinned, so dump/restore and restaurant↔ledger currency
continuity can disagree under `LC_CTYPE` drift.

## Fix

Additive migration
`20260927090000_mise_005al_purchase_line_currency_locale_pin.sql`
reattaches `purchase_lines_currency_check` as:

```sql
currency is null
or currency collate "C" ~ '^[A-Z]{3}$'
```

## Out of scope

- Does not rewrite `private.append_purchase_line` (open MISE-006 #397 / #398)
- Does not rewrite `public.ingest_purchase_lines` (open MISE-005G #415)
- Does not rewrite purchase_lines cntrl CHECKs (open MISE-005F #414)
- Does not rewrite restaurants currency (open MISE-005AB #436)
- Does not change domain `CURRENCY_PATTERN` (ASCII `[A-Z]` already)

## Compose

Compose-safe alone on main. CHECK-only; no function rewrite. Prefer after
MISE-005AB (#436) restaurants currency pin for profile↔ledger parity;
timestamp after MISE-005AK (#445). Compatible with open #414/#415/#397
because those paths own different constraints or writers.

## Verification

- `npm run typecheck`
- focused `tests/purchaseLineCurrencyLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed; not executed here (no Docker)
