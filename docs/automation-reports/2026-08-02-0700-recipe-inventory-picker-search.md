# Recipe inventory picker search (2026-08-02)

## Gap
Recipe baseline linking required near-exact inventory item names and only surfaced the first seven catalog chips. Larger kitchens could not reliably find the right SKU while mapping POS dishes.

## Change
- Added pure domain helpers in `services/domain/inventoryItemSearch.ts`:
  - `searchInventoryItemsForPicker` ranks by exact / prefix / token / substring, then category and supplier.
  - `resolveInventoryItemForRecipeLink` accepts explicit selection id, exact name, or a single unambiguous hit.
  - `filterMenuItemsForPicker` filters unmapped POS dish chips as the operator types.
- Updated `/settings/recipes` builder to search-as-you-type, select by id, keep restaurant ownership checks, and show selected / no-match hints.
- Localized EN / ES / zh-Hans copy for search placeholders and picker state.
- Unit coverage in `tests/inventoryItemSearch.test.ts`; static security contract in `tests/security.test.ts`.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` remains unavailable in this environment.
