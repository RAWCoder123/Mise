# MISE-005IV: pin inventory canonical-unit conversion to COLLATE C

## Summary

`private.canonical_unit_for_standard_unit` and
`private.canonical_quantity_per_standard_unit` were IMMUTABLE but still folded
case with bare `lower(trim(...))`, which follows database `LC_CTYPE`. MISE-005A
proved locale drift on this libc en_US.UTF-8 cluster. These helpers drive
verified inventory conversion and purchase-approval recipe-unit compatibility.

This tip rewrites both helpers so case folding uses
`lower(btrim(...) collate "C")`, preserves the exact CASE vocabulary, re-asserts
EXECUTE revoke from client roles, and aligns client `normalizeUnit` with ASCII
C-locale case folding.

## Scope

- Function rewrite only for the two IMMUTABLE conversion helpers
- Client ASCII C lower for operational unit normalize
- Does **not** reattach `canonical_unit` CHECKs (#490/#491)
- Does **not** rewrite normalize/enforce triggers or supplier-name normalize (#410)

## Verification

- `npm run typecheck`
- focused `tests/canonicalUnitConversionLocalePin.test.ts`
- `npm test`
- pgTAP fixture committed (`plan(12)` from 12 assertion call sites); Docker
  unavailable in this environment

Alone-OK on main. Timestamp after MISE-005IU (#663).
