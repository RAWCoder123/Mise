# Scoped inventory cycle-count sessions — 2026-09-02

## Gap

Inventory count sessions always inserted every verified canonical item. Operators
could not run a high-risk or category cycle count without counting the full sheet,
so partial physical counts were blocked by the complete-sheet submit rule.

## Change

- Domain `resolveCountSessionEligibleItems` / `buildCountSessionLinesFromInventory`
  accept an optional inventory-item id scope.
- Validation `requireInventoryCountSessionItemIds` (null = full sheet).
- Migration `20260902210000_scoped_inventory_count_sessions.sql` adds
  `p_inventory_item_ids uuid[]` to begin RPCs (service_role only).
- Edge `begin_count_session` forwards scoped ids.
- Demo + hosted repositories and application begin APIs accept the scope.
- `/inventory/count` start screen lets operators search/select items; full
  selection still begins a full sheet (`null` scope).

## Explicit non-goals

- Opening-note UI (open #300)
- Active-item filtering (open #281)
- Inventing MOQ / lead_time / expiration
- Changing approve/submit completeness rules for lines that are in the session

## Verification

- Focused domain/validation tests for scoped begin
- `npm run typecheck`
- `npm test` (see tip evidence)
- `npm run security:static` / `security:backend` / `design:static`
