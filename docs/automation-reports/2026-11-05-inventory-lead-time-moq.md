# Inventory lead time and minimum order quantity

Date: 2026-11-05  
Branch: `cursor/mise-inventory-lead-time-moq-main`

## Problem

Purchase recommendations restored to par from reorder threshold alone. Catalog pack
rounding (#1106) closed case-size accuracy, but inventory items still had no durable
supplier lead time or minimum order quantity, so Mise could recommend too late or
below a vendor’s real MOQ.

## Change

- Additive migration `20261105170000_inventory_lead_time_and_moq.sql`
  - `inventory_items.lead_time_days` (integer 0–365, default 0)
  - `inventory_items.minimum_order_quantity` (numeric 0–1_000_000, default 0)
  - Extends `private.service_update_inventory_and_signals` policy patch allowlist
- Domain helpers in `services/domain/inventoryOrderPolicy.ts`
  - MOQ raises a positive shortfall only; never invents an order from MOQ alone
  - Coverage at or below lead time raises a reorder recommendation
- Wired through operational signals, inventory predictions, Edge patch validation,
  inventory detail settings (EN/ES/zh-Hans), and demo defaults for a few items

## Out of scope

- Expiration dating on receive (touches open receive stack #1109/#1111)
- Pack-quantity rounding (owned by open #1106)
- Changing purchase approval or supplier-send authority

## Verification

- Focused `tests/inventoryOrderPolicy.test.ts`
- `tests/serviceInventoryPolicyOnlyPatches.test.ts` updated to current migration
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- Docker pgTAP source at `supabase/tests/database/inventory_lead_time_moq.test.sql`
  (not executed in this environment)
