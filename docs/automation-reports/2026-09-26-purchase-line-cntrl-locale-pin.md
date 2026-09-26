# MISE-005F: pin purchase_lines cntrl CHECKs to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-purchase-line-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.purchase_lines` is append-only. Its text CHECKs still used bare POSIX
`[[:cntrl:]]`, which follows database `LC_CTYPE`. MISE-005A already proved
locale drift on this cluster for `lower()` / `[[:alnum:]]` on the same table;
MISE-005B re-pinned `suppliers.display_name` with
`collate "C" !~ '[[:cntrl:]]'`. MISE-005D pinned unit/pack helpers but
explicitly did **not** touch CHECK-backed cntrl sites.

If a glibc/ICU change reclassified a stored byte, `pg_dump`/`restore` could
reject rows the source accepted — and those rows cannot be repaired in place
without dropping the append-only guarantee.

## Change

- Additive migration `20260926002000_mise_005f_purchase_line_cntrl_locale_pin.sql`
  - Helper `private.purchase_line_has_control_characters` (`collate "C" ~ '[[:cntrl:]]'`)
  - `private.purchase_line_text` uses the helper
  - Reattach four text CHECKs with `… collate "C" !~ '[[:cntrl:]]'`
- Domain comment documents that `CONTROL_CHARACTERS` matches ASCII C `[[:cntrl:]]`
- Source-pin + pgTAP fixtures committed

Does **not** redeclare `ingest_purchase_lines` / `append_purchase_line` so this
composes with open MISE-006 and purchase-line date-bounds stacks. Restore
authority is the CHECK.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#413
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
