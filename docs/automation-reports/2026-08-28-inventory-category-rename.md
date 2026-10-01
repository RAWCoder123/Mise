# Inventory category and rename policy (2026-08-28)

## Summary

Managers can correct inventory item display name and category after setup through
the existing service-owned inventory policy patch path. On-hand quantity remains
ledger-only. Supplier identity stays on its dedicated reassignment workflow.

## Why

Category drives hub icons, search, and subtitles, but was locked after
`setup_completed`. Item rename was likewise setup-only, forcing operators to
live with typos or re-run setup. This was the highest-impact main-alone gap not
covered by open stacks #130–#236 / #147.

## Changes

- Additive migration `20260828190000_inventory_policy_category_rename.sql`
  extends `private.service_update_inventory_and_signals` allowlist with
  `item_name` (1–160) and `category` (1–120), with whitespace normalization,
  control-character rejection, and same-tenant duplicate-name protection.
- Edge `requireInventoryPatch`, client validation, and `InventoryItemPatch`
  accept the same fields.
- Inventory detail settings card edits name + category with EN/ES/zh-Hans copy.
- pgTAP and static security pins updated.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend` / `npm run security:static` when available

## Notes

- Open PR #231 (estimated unit cost) also replaces this function; rebase must
  union `estimated_unit_cost` with `item_name` / `category`.
- Hosted migration deploy required before production use.
