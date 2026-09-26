# MISE-005H: pin purchase_decision_events.recommendation_unit cntrl CHECK to COLLATE C

Date: 2026-09-26  
Branch: `cursor/mise-purchase-decision-unit-cntrl-locale-pin`  
Base: `origin/main` @ `78da737`

## Problem

`public.purchase_decision_events` is append-only decision evidence (MISE-004A).
Its `recommendation_unit` CHECK still used bare POSIX `[[:cntrl:]]`, which
follows database `LC_CTYPE`. MISE-005A already proved locale drift on this
cluster for `lower()` / `[[:alnum:]]`; MISE-005B and MISE-005F re-pinned
`suppliers.display_name` and `purchase_lines` text columns with
`collate "C" !~ '[[:cntrl:]]'`.

If a glibc/ICU change reclassified a stored byte under bare `[[:cntrl:]]`,
`pg_dump`/`restore` could reject rows the source accepted — and those rows
cannot be repaired in place without dropping the append-only guarantee.

## Change

- Additive migration `20260926021500_mise_005h_purchase_decision_unit_cntrl_locale_pin.sql`
  - Reattach `purchase_decision_events_recommendation_unit_check` with
    `recommendation_unit collate "C" !~ '[[:cntrl:]]'`
  - Preserve the existing 1–80 trimmed length bound
- Domain `CONTROL_CHARACTERS` documents ASCII C `[[:cntrl:]]` parity and
  fail-closes local event construction on control-bearing units
- Source-pin + pgTAP fixtures committed

Does **not** rewrite approve / dismiss / undo wrappers so this composes with
open purchase-authority stacks. Restore authority is the CHECK.

## Verification

- `npm run typecheck`
- `npm test` (focused + full suite)
- pgTAP committed; Docker/pgTAP unavailable in this environment

## Out of scope

- Landing/rebasing open stacks #348–#415
- `realtime.to_regrole` audit
- Inventing MOQ / lead_time / expiration
- Contested receive / `record_supplier_delivery` size checks
