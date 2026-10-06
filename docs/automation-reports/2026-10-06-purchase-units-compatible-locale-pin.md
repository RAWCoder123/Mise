# MISE-005IW: pin purchase_units_compatible lower() to COLLATE C

Date: 2026-10-06
Branch: `cursor/mise-purchase-units-compatible-locale-pin`
Base: `origin/main` @ `78da7376`

## Problem

`private.purchase_units_compatible` (MISE-003A) is declared IMMUTABLE but still
folds recipe and item unit tokens with bare `lower(trim(...))`, which follows
database `LC_CTYPE`. MISE-005A proved locale drift on this cluster. The helper
gates recipe-authority readiness and purchase-approval `recipe_unit_incompatible`
blockers. Locale drift could flip compatibility for rows the source accepted.

## Change

Additive function rewrite only:

- Migration `20261007100000_mise_005iw_purchase_units_compatible_locale_pin.sql`
- Case folding uses `pg_catalog.lower(pg_catalog.btrim(...) collate "C")`
- Preserves exact-match and canonical-dimension fallback semantics
- Re-asserts EXECUTE revoke from public/anon/authenticated/service_role

Does **not** rewrite `canonical_unit_for_standard_unit` (#664), supplier-name
normalize (#410), or recommendation unit CHECKs.

## Verification

- `npm run typecheck`
- focused `tests/purchaseUnitsCompatibleLocalePin.test.ts`
- `npm test`
- pgTAP plan 10 from 10 assertion call sites (Docker availability noted at run time)

## Classification impact

Controlled pilot-ready codebase. Locale pin hardens purchase-authority unit
identity across dump/restore. Does not unblock live POS/Gmail or App Store
credentials.
