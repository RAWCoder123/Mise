# MISE-005B: pin supplier name normalization to one locale

Date: 2026-09-25  
Branch: `cursor/mise-supplier-name-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`private.normalize_supplier_display_name` / `normalize_supplier_name` were declared
`IMMUTABLE` but used bare `[[:space:]]` and `lower()` against database `LC_CTYPE`.
Those functions back CHECK + UNIQUE on `public.suppliers`. A ctype/ICU change
that moved the recomputed key would make restore reject rows the source accepted,
or split/collide setup discovery for accented names. MISE-005A already fixed this
class for `purchase_lines`; suppliers remained unpinned.

## Change

- Additive migration `20260925201400_mise_005b_supplier_name_locale_pin.sql`
  - Drop CHECK, rewrite normalize functions with `COLLATE "C"`
  - Display path: explicit NBSP fold + C whitespace collapse (preserves accents/case)
  - Discovery key: reuse `private.fold_purchase_line_accents`, then `lower(... COLLATE "C")`
  - Backfill display/normalized names; disambiguate accent-fold collisions with a
    stable ` · ` + id prefix suffix on newer rows (durable `supplier_id` unchanged)
  - Reattach CHECK with `display_name collate "C" !~ '[[:cntrl:]]'`
- Domain helpers `services/domain/supplierNameNormalization.ts`
- Demo identity mirrors the domain helpers (no `toLocaleLowerCase` / `\s`)
- TS source pins + pgTAP `supplier_name_locale_pin.test.sql` (11 assertions)

## Verification

- `npm run typecheck` — pass
- `npm test` — 681 pass / 0 fail / 7 cancelled
- Focused: `tests/supplierNameNormalization.test.ts` + `tests/demoSupplierIdentity.test.ts` — 10/10
- Hosted/local pgTAP deferred (Docker not available in this environment)

## Explicitly not done

- Did not invent MOQ / lead_time / expiration
- Did not touch open stacks #348–#409
- Did not change durable `supplier_id` authority semantics
- Did not rewrite `create_supplier` / `rename_supplier` bodies beyond what the
  shared normalize functions already change
