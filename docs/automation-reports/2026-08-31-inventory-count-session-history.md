# Inventory count session history (2026-08-31)

## Problem

Operators could begin, continue, submit, and approve multi-item inventory count
sessions, but past approved or cancelled sessions had no browse UI. Repository
SELECT and `fetchInventoryCountSession` already existed; only the open-session
path was wired to the app.

## Change

- Add bounded `listInventoryCountSessions` on demo and hosted repositories
  (default closed statuses, limit 40).
- Expose `listInventoryCountSessionHistory` and `fetchInventoryCountSession`
  through the inventory application facade.
- Seed one approved demo count session with variance lines.
- Add `/inventory/count-history` list and `/inventory/count-session/[id]`
  read-only detail screens with EN / ES / zh-Hans copy.
- Link History from the Inventory hub count card and the count start screen.

## Verification

- `npm run typecheck`
- Focused: `tests/inventoryCountSessionHistory.test.ts`
- `npm test`

## Notes

- No migration. Uses existing authenticated SELECT on `inventory_count_sessions`
  / `inventory_count_lines`.
- Does not invent line items for history; empty state is explicit when no closed
  sessions exist for a live tenant.
