# Inventory item activate / deactivate (2026-08-30)

## Problem

Discontinued SKUs stayed in count sessions, purchase recommendations, Home/Today
stock-risk attention, and Daily Report dollars-at-risk forever. Managers had no
post-setup way to retire an inventory item without deleting history.

## Change

- Additive `inventory_items.active` (default true) plus manager+
  `set_inventory_item_active` SECURITY DEFINER RPC (empty `search_path`, audited,
  no authenticated UPDATE grant).
- New count sessions exclude inactive items (SQL begin + domain eligibility).
- Purchase recommendation generation, Today risk tasks, Home operating brief,
  inventory control summary, and Daily Report dollars-at-risk ignore inactive
  items. Ledger events and detail history remain available.
- Inventory detail toggle + Inactive badge; Add to Order blocked while inactive.
- Inventory hub attention groups skip inactive; list rows show Inactive badge.
- Demo repository parity; EN / ES / zh-Hans catalog keys.

## Verification

- `npm run typecheck`
- `npm test` (focused `inventoryItemActiveControl` + full suite)
- `npm run security:static`

## Classification

Controlled-pilot improvement. Hosted migration deploy still required for live
tenants.
