# Inventory waste / spoilage recording

Date: 2026-07-31

## Problem

The inventory ledger already allowed a `waste` movement reason, but operators had no write path. Waste could only appear as an insight signal (`insight.rule.waste.overstock`), so spoilage never reduced on-hand stock or entered the audit trail.

## Solution

Added an end-to-end `record_waste` workflow separate from absolute count saves:

- Pure planner: `services/domain/inventoryWaste.ts`
- Validation: `requireInventoryWasteQuantity` / `requireInventoryWasteNote`
- Application: `recordInventoryWaste` rebuilds recommendations/insights then commits
- Demo + hosted repository methods write a `waste` ledger row and update on-hand
- Hosted RPC: `service_record_inventory_waste_and_signals` (service_role only)
- Edge action: `record_waste` on `operational-workflows`
- Inventory detail UI: Record waste card with quantity + optional note (EN / ES / zh-Hans)

Excess waste requests floor at zero on-hand and retain the requested quantity in movement metadata.

## Verification

- Unit tests for planning/validation
- Security static wiring checks
- Client race guard for waste save
- pgTAP assertions for deduct + ledger + authenticated execute denial
- Staging service RPC forged-tenant denial probe
