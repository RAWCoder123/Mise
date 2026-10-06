# MISE-005IX: pin purchase-line unit helper lower() to COLLATE C

Date: 2026-10-06
Branch: `cursor/mise-purchase-line-unit-helpers-locale-pin`
Base: `origin/main` @ `78da7376`

## Problem

`private.purchase_line_unit_dimension` and `private.purchase_line_pack_unit`
(MISE-004C) are declared IMMUTABLE but still fold unit tokens with bare
`lower(...)`, which follows database `LC_CTYPE`. MISE-005A proved locale drift
on this cluster. These helpers feed `purchase_line_consistency_flags`; a
mass/volume mismatch yields `pack_unit_dimension_conflict` and caps confidence
at `could_not_verify`. Locale drift could flip confidence for lines the source
accepted.

## Change

Additive function rewrite only:

- Migration `20261007120000_mise_005ix_purchase_line_unit_helpers_locale_pin.sql`
- Case folding uses `pg_catalog.lower(... collate "C")`
- Preserves mass/volume vocabulary and trailing pack-unit extract semantics
- Re-asserts EXECUTE revoke from public/anon/authenticated/service_role

Does **not** rewrite fold/normalize purchase-line helpers (MISE-005A),
`purchase_units_compatible` (#665), conversion helpers (#664), or supplier-name
normalize (#410).

## Verification

- `npm run typecheck`
- focused `tests/purchaseLineUnitHelpersLocalePin.test.ts`
- `npm test`
- pgTAP plan 12 from 12 assertion call sites (Docker availability noted at run time)

## Classification impact

Controlled pilot-ready codebase. Locale pin hardens purchase-line consistency
confidence across dump/restore. Does not unblock live POS/Gmail or App Store
credentials.
