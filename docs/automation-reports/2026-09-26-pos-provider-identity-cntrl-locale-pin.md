# MISE-005I: pin pos_sales provider-identity cntrl CHECKs to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-pos-provider-identity-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.pos_sales` provider identity columns (`provider_catalog_item_id`,
`provider_location_id`, `provider_variation_id`) still reject control characters
with bare POSIX `[[:cntrl:]]`, which follows database `LC_CTYPE`. MISE-005A
already proved locale drift on this cluster for `lower()` / `[[:alnum:]]`;
MISE-005B / MISE-005F / MISE-005H re-pinned sibling text CHECKs with
`collate "C" !~ '[[:cntrl:]]'`.

These IDs are the authoritative bridge from POS sales to recipe depletion. If a
glibc/ICU change reclassified a stored byte under bare `[[:cntrl:]]`,
`pg_dump`/`restore` could reject identity-bearing sales rows the source
accepted.

## Change

- Additive migration `20260926032000_mise_005i_pos_provider_identity_cntrl_locale_pin.sql`
  - Reattach the three provider-identity CHECKs with
    `<column> collate "C" !~ '[[:cntrl:]]'`
  - Preserve existing nullable + 1–128 length bounds
- Domain `CONTROL_CHARACTERS` documents ASCII C `[[:cntrl:]]` parity and
  fail-closes recipe resolution when identity tokens contain controls
- Source-pin + pgTAP fixtures committed

Does **not** rewrite POS ingest / authority-correction wrappers so this
composes with open POS sync and purchase-authority stacks. Restore authority is
the CHECK.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#416
- `realtime.to_regrole` audit
- Gmail / supplier-send envelope cntrl siblings (next survey candidates)
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
