# Inventory shelf life days (2026-11-05)

## Summary

Managers can set `shelf_life_days` on inventory items. When projected coverage
exceeds that shelf life, Mise surfaces spoilage risk on inventory predictions
and waste overstock insights without inventing lot expiration dates or changing
purchase/send authority.

## Scope

- Additive migration `20261105180000_inventory_shelf_life_days.sql`
- Extends service-owned inventory policy patch allowlist + Edge validation
- Domain helpers: shelf life of 0 keeps the generic three-day overstock heuristic
- Inventory detail settings + EN/ES/zh-Hans
- Demo defaults for a few perishable items

## Out of scope

- Lot-level expiration dating on receive (still waits on #1109/#1111 land)
- Lead time / MOQ (#1116)
- Pack rounding (#1106)
- Purchase approval or supplier-send authority

## Verification

- `npm run typecheck`
- Focused `tests/inventoryShelfLifePolicy.test.ts`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- pgTAP source at `supabase/tests/database/inventory_shelf_life_days.test.sql`
