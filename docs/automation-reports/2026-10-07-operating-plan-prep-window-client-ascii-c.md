# MISE-005JO: pin operatingPlan prep-window tokens to ASCII C

Date: 2026-10-07

## Summary

Pin Daily Operating Plan prep-window token identity
(`normalizeOperatingPlanPrepWindowToken`) to ASCII C case fold and ASCII-only
whitespace trim so restaurant `prepWindows` profile strings cannot invent or
suppress service-window mappings via Unicode `toLocaleLowerCase` / `trim`.

## Why

`evidenceFromPrepWindows` previously used `trim().toLocaleLowerCase("en-US")`
before `parsePrepWindowToken`. Sibling client tips already pin inventory, menu,
email, and demand keys to ASCII C. Prep-window tokens are the operator-entered
identity that maps onto `before_prep` / `before_lunch` / `before_dinner` /
`during_service` / `closing` descriptors. Kelvin (`K`) and NBSP padding must
not become lookalike ASCII tokens.

## Change

- `services/domain/operatingPlan.ts`: ASCII C helpers + exported normalize;
  evidence path uses the normalize for matching and ASCII trim for display.
- Focused static + behavioral tests.
- No SQL migration (profile tokens are client-parsed; no CHECK rewrite).

## Verification

- `npm run typecheck`
- focused `tests/operatingPlanPrepWindowClientAsciiC.test.ts`
- `npm test`
- `npm run security:static` / `npm run security:backend` when available

## Out of scope

- Landing/rebasing open stacks #348–#683
- Re-tipping tipped identity files (demoRepository #683, setup #679/#680, etc.)
- Contested SQL mutators / ingest rewrites
