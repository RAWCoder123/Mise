# Scoped inventory cycle-count sessions — main rebase 2026-11-05

Tip: `cursor/mise-scoped-inventory-count-sessions-main-rebase`
Supersedes stale #358 (`cursor/mise-product-inspection-d12c` @ `f25e270f`).

## Gap

Inventory count sessions always inserted every verified canonical item. Operators
could not run a high-risk or category cycle count without counting the full sheet,
so partial physical counts were blocked by the complete-sheet submit rule.

## Change

- Domain `resolveCountSessionEligibleItems` / `buildCountSessionLinesFromInventory`
  accept an optional inventory-item id scope.
- Validation `requireInventoryCountSessionItemIds` (null = full sheet).
- Migration `20261105070000_scoped_inventory_count_sessions.sql` adds
  `p_inventory_item_ids uuid[]` to begin RPCs (service_role only). Renamed after
  MISE-004C (`20260903120000`) so hosted tenants past that migration still apply it.
- Edge `begin_count_session` forwards scoped ids.
- Demo + hosted repositories and application begin APIs accept the scope.
- `/inventory/count` start screen lets operators search/select items; full
  selection still begins a full sheet (`null` scope).

## Explicit non-goals

- Opening-note UI (open #300)
- Active-item filtering (open #281)
- Inventing MOQ / lead_time / expiration
- Changing approve/submit completeness rules for lines that are in the session

## Land notes

Do not merge stale #358. Prefer this tip. Ordinary conflicts expected with open
product tips that also touch `i18n/catalog.ts` or inventory count UI.

## Verification

- Focused domain/validation tests for scoped begin
- `npm run typecheck`
- `npm test` (see tip evidence)
- `npm run security:static` / `security:backend` / `design:static`
- Docker pgTAP not run in this environment (`supabase/tests/database/inventory_count_sessions.test.sql` updated for 4-arg signature)
