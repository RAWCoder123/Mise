# Menu item active/inactive control (2026-08-28)

## Problem
`menu_items.active` already gates planning joins, POS mapping review, purchase
authority, and recipe confirmation, but managers had no operator control after
POS sync inserted items as active. Taking a dish off the menu required raw SQL
or leaving demand authority incorrectly live.

## Fix
- Additive migration `20260828200000_set_menu_item_active.sql` adds manager+
  `public.set_menu_item_active` (SECURITY DEFINER, empty `search_path`).
- Idempotent toggle; audited as `menu_item_activated` / `menu_item_deactivated`.
- Existing `menu_items` planning-revision trigger continues to fire on `active`.
- No authenticated DML grant on `menu_items` (select-only preserved).
- Application/repo/demo wiring + Recipes settings UI with EN/ES/zh-Hans copy.
- Inactive rows stay visible for reactivation; confirm is blocked while inactive.

## Verification
- `npm run typecheck`
- `npm test` (includes `tests/menuItemActiveControl.test.ts`)
- `npm run security:backend`
- `npm run security:static`
- Docker/hosted pgTAP unavailable in this environment; SQL test shipped for CI.

## Report tip
`cursor/mise-menu-item-active-control`
