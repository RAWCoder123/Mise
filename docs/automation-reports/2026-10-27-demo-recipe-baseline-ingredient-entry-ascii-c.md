# MISE-005RT: pin demo recipe-baseline ingredient entries to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-demo-recipe-baseline-ingredient-entry-ascii-c`

## Inventing proof

`services/demo/replaceableDemoData.ts` `parseRecipeLine` fed each
comma-separated recipe-baseline ingredient token through `entry.trim()`
before the quantity/unit regex and durable demo menu-item ingredient
mappings via `applyRecipeBaselineText` / `applyDemoSetupProfile`.

Unicode trim invents a clean ingredient entry
(`'\u2003chicken breast 0.25 lbs\u2003'.trim() === 'chicken breast 0.25 lbs'`).
Soft-empty Unicode-only space invented an empty entry that the empty filter
dropped.

Open #905 / MISE-005RS pins demo recipe-baseline `menuItemName` — not this
comma-entry sink. Open #898 / MISE-005RL pins setup-drafts recipe ingredient
`itemName` before baseline text is built — not this demo apply parser sink.

## Change

- Add `services/domain/demoRecipeBaselineIngredientEntryIdentity.ts` (MISE-005RT)
- Soft empty / Unicode-only space → `empty`
- ASCII whitespace still trims clean before the quantity/unit regex
- Unicode-padded / control → `invalid` (skip that ingredient entry)
- Wire `parseRecipeLine` through `prepareDemoRecipeBaselineIngredientEntryText`
- Leave `menuItemName.trim()` (#905), ingredient `itemName` / `unit` bare trim,
  baseline-text soft empty, line trim, setup-drafts ingredient itemName (#898),
  and normalizeSetupList (#686) alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #905/#899/#898/#897/#902/#901/#686. Keep
`demoRecipeBaselineIngredientEntryIdentity.ts` separate from
`demoRecipeBaselineMenuItemNameIdentity.ts` /
`setupDraftsRecipeIngredientItemNameIdentity.ts`. When landing with #905, drop
this tip's bare `menuItemName: menuItemName.trim()` assertion once #905 owns
that path. When landing with #898, drop this tip's bare setup-drafts
`ingredient.itemName.trim()` assertion once #898 owns that path.
