# MISE-005D: pin purchase-line unit/pack helpers to COLLATE C

Date: 2026-09-25
Branch: `cursor/mise-purchase-line-unit-locale-pin`
Base: `origin/main` @ `78da737`

## Problem

`private.purchase_line_unit_dimension` and `private.purchase_line_pack_unit` were
declared IMMUTABLE but used bare `lower()`. MISE-005A proved `lower()` differs
between en_US.UTF-8 and C for accented uppercase input on this cluster.

These helpers only classify ingest-time consistency flags
(`pack_unit_dimension_conflict`). They do not back CHECK/UNIQUE restore keys, so
there is no dump/restore abort hazard. They still need a ctype pin so flag
classification cannot drift across libc/ICU changes or diverge from the
TypeScript mirror.

MISE-005A fixed item keys; MISE-005B (#410) suppliers; MISE-005C (#411) menu
items. Unit/pack helpers remained.

## Change

- Additive migration `20260925220600_mise_005d_purchase_line_unit_locale_pin.sql`
- Both helpers now use `lower(... COLLATE "C")`; pack unit keeps ASCII `[a-z]+`
- No accent fold (unit vocabulary is ASCII); no ledger backfill
- Domain TS: `asciiLower` (A-Z only) in `purchaseLineUnitDimension` /
  `purchaseLinePackUnit` — `toLowerCase()` would not match the server
- Source pin test + pgTAP fixtures committed

## Verification

- `npm run typecheck`
- `npm test` (focused unit locale pin + purchase line tests + full suite)
- pgTAP file committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Open stacks #348–#411 (do not rebase/land here)
- `pg_column_size` / `realtime.to_regrole` audit leftovers from MISE-005
- Inventing MOQ / lead_time / expiration
