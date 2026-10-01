# POS mapping menu-item ranked search (2026-08-29)

## Gap

Settings → POS mappings expanded the full active menu-item radio list with no find UI. Hosted queues can return up to 200 choices, so managers had to scroll blindly when verifying Square catalog suggestions.

## Implementation

- Domain: `services/domain/posMappingMenuItemSearch.ts`
  - `filterPosMappingMenuItemsBySearch`
  - `POS_MAPPING_MENU_ITEM_SEARCH_THRESHOLD` (8)
  - Ranks name (exact / prefix / includes / multi-token) and category; dedupes by id; skips blank names
- UI: `app/settings/pos-mappings.tsx`
  - Search when active menu items > 8
  - Showing X of Y + empty-match copy
  - Query resets on restaurant change and when the expanded mapping changes
- i18n EN / ES / zh-Hans: `pos.mappings.search.*`
- Tests: `tests/posMappingMenuItemSearch.test.ts` (5)

## Out of scope

Does not change verify/reject authority, mapping RPC contracts, create-task dependency picker, or open stacks #132–#246.

## Verification

- `npm run typecheck`
- focused domain tests
- `npm test`
- `npm run design:static`
- `npm run security:static`
