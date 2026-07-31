# Staff inventory waste recording

Date: 2026-07-31

## Problem

Kitchen staff already observe spoilage during service and can draft inventory counts, but waste recording remained manager-only. That left on-hand stock wrong until a manager was available, and forced staff into a misleading view-only inventory detail screen.

## Solution

Expanded waste authorization to active `owner|admin|manager|staff` while keeping absolute count, par/reorder, and ordering edits manager+:

- Domain helper: `canRecordInventoryWaste` / `INVENTORY_WASTE_RECORD_ROLES`
- Tenant helper wired for UI gating
- Migration `20260731060925_staff_inventory_waste_roles.sql` updates the service RPC role check
- Edge `staffOperationalActions` includes `record_waste`
- Inventory detail shows Record waste for staff with limited-access copy

Waste still writes an immediate `waste` ledger movement attributed to the actor. No draft/approve step—spoilage should reduce stock when observed.

## Verification

- Unit tests for role helpers and waste planning
- Security static wiring checks for SQL/Edge/UI
- pgTAP: staff actor waste succeeds; authenticated direct RPC still denied
