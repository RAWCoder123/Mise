# Inventory durable supplier reassignment UI (2026-08-28)

## Summary
Managers can reassign an inventory item to another durable supplier identity (or create-and-assign a new one) from inventory detail. Backend RPC/demo/repository support already existed from MISE-003C; this tip adds the operator surface.

## Why
After setup completion, supplier identity is locked to durable IDs. Detail UI previously only showed `supplier_name` in the subtitle, so wrong bindings could not be corrected without setup replay. Wrong supplier → wrong purchase authority, drafts, and send grouping.

## Changes
- `app/inventory/[id].tsx`: load `fetchSuppliers`, manager-gated chooser, reassign via `reassignInventoryItemSupplier`, create-and-assign via `createSupplier`, fail-closed tenant checks, localized purchasing-block errors.
- `i18n/catalog.ts`: EN / ES / zh-Hans supplier-assignment copy.
- `tests/inventorySupplierReassignUi.test.ts`: UI wiring + demo repository proof.
- `tests/clientTenantSafety.test.ts`: pin hub-ready suppliers + reassignment stale-continuation guard.

## Verification
- `npm run typecheck` passed
- Targeted tests passed (inventorySupplierReassignUi, clientTenantSafety, localization, demoSupplierIdentity)
- `npm test` — 634 pass, 7 cancelled (`recalculationCycles` withTimeout hung-parent flake; unrelated)
- `npm run security:static` passed
- `npm run design:static` passed

## Classification impact
Still controlled-pilot/private-beta. Unblocks post-setup supplier authority correction for managers.
