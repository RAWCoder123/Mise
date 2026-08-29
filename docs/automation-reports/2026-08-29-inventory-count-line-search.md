# Inventory count line ranked search (2026-08-29)

## Gap
Inventory count sessions on `origin/main` (@ `20b28e5`) rendered every count
line with no find UI. Staff and managers had to scroll the full sheet. Closed
PR #65 never landed; open PRs #152/#155 only cover soft-refresh fail-closed and
draft preserve.

## Change
- Domain: `filterInventoryCountLinesBySearch` +
  `INVENTORY_COUNT_LINE_SEARCH_THRESHOLD` (8) ranks name/unit matches without
  inventing rows.
- UI: `/inventory/count` shows find when the session has more than eight lines,
  with showing X of Y and empty-match copy. Save/submit still use the full
  session line set, so drafts for filtered-out lines are preserved.
- i18n: EN / ES / zh-Hans under `inventory.count.search.*`.

## Verification
- `npm run typecheck`
- `node --test --import tsx tests/inventoryCountLineSearch.test.ts`
- `npm test`
