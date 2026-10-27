# MISE-005RU: pin demo recipe-baseline lines to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-demo-recipe-baseline-line-ascii-c`

## Inventing proof

`services/demo/replaceableDemoData.ts` `applyRecipeBaselineText` fed each
newline-split recipe-baseline line through `line.trim()` before
`parseRecipeLine` and durable demo menu-item ingredient mappings via
`applyDemoSetupProfile`.

Unicode trim invents a clean recipe-baseline line
(`'\u2003Unique Demo Bowl: chicken breast 0.25 lbs\u2003'.trim() ===
'Unique Demo Bowl: chicken breast 0.25 lbs'`). Soft-empty Unicode-only space
invented an empty line that the empty filter dropped.

Open #905 / MISE-005RS pins demo recipe-baseline `menuItemName` — not this
full-line sink. Open #906 / MISE-005RT pins comma-separated ingredient entries —
not this full-line sink. After entry prep, `match[1]!.trim()` /
`match[3]!.trim()` do not invent (proved no-op); left alone.

## Change

- Add `services/domain/demoRecipeBaselineLineIdentity.ts` (MISE-005RU)
- Soft empty / Unicode-only space → `empty`
- ASCII whitespace still trims clean before `parseRecipeLine`
- Unicode-padded / control → `invalid` (skip that line)
- Wire `applyRecipeBaselineText` through `prepareDemoRecipeBaselineLineText`
- Leave `menuItemName.trim()` (#905), `entry.trim()` (#906), ingredient
  `itemName` / `unit` bare trim, baseline-text soft empty, setup-drafts
  dishName (#900), setup-drafts POS CSV `line.trim()`, and normalizeSetupList
  (#686) alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles
  cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #905/#906/#900/#899/#898/#897/#686. Keep
`demoRecipeBaselineLineIdentity.ts` separate from
`demoRecipeBaselineMenuItemNameIdentity.ts` /
`demoRecipeBaselineIngredientEntryIdentity.ts` /
`setupDraftsRecipeDishNameIdentity.ts`. When landing with #905/#906, drop
those tips' bare `.map((line) => line.trim())` assertions once this tip owns
that path. When landing with #905, drop this tip's bare
`menuItemName: menuItemName.trim()` assertion once #905 owns that path. When
landing with #906, drop this tip's bare `entry.trim()` assertion once #906
owns that path.
