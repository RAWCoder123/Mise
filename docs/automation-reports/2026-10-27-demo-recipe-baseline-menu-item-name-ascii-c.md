# MISE-005RS: pin demo recipe-baseline menuItemName to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-demo-recipe-baseline-menu-item-name-ascii-c`

## Inventing proof

`services/demo/replaceableDemoData.ts` `parseRecipeLine` fed the left-hand
recipe-baseline dish token through `menuItemName.trim()` into durable demo
`menu_item_name` mappings via `applyRecipeBaselineText` /
`applyDemoSetupProfile`.

Unicode trim invents a clean dish name
(`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`). Soft-empty
Unicode-only space invented an empty durable `menu_item_name`.

Open #900 / MISE-005RN pins setup-drafts `recipe.dishName` before baseline
text is built — not this demo apply parser sink. Open #686 / MISE-005JQ pins
`normalizeSetupList` / lookup keys — not `parseRecipeLine` menuItemName.

## Change

- Add `services/domain/demoRecipeBaselineMenuItemNameIdentity.ts` (MISE-005RS)
- Soft empty / Unicode-only space → `empty`
- ASCII whitespace still trims clean before durable `menu_item_name`
- Unicode-padded / control → `invalid` (skip the baseline line)
- Wire `parseRecipeLine` through `prepareDemoRecipeBaselineMenuItemNameText`
- Leave ingredient `itemName` / `unit` / entry trim, baseline-text soft empty,
  line trim, setup-drafts dishName (#900), and normalizeSetupList (#686) alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #900/#899/#898/#897/#862/#686. Keep
`demoRecipeBaselineMenuItemNameIdentity.ts` separate from
`setupDraftsRecipeDishNameIdentity.ts` / `setupRecipeDishNameIdentity.ts` /
replaceableDemo setup-list helpers. When landing with #900, drop this tip's
bare `const dishName = recipe.dishName.trim()` assertion once #900 owns that
path. When landing with #686, drop this tip's bare `normalizeSetupList`
`value.trim()` assertion once #686 owns that helper.
