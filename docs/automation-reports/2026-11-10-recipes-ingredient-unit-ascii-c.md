# MISE-005ABI Settings Recipes ingredient.unit ASCII C (2026-11-10)

## Summary
Soft-null empty/Unicode-padded/control-bearing Settings Recipes `ingredient.unit` and builder `selectedInventoryItem.unit` before quantityUnit Text, readOnlyAccessibility `{unit}`, and builder unit preview so blank-looking or Unicode-trimmed unit identity cannot invent clean unit copy. Present-but-unsafe values fall through to localized `recipes.ingredient.unit.none` (EN unit / ES unidad / zh-Hans 单位).

## Changes
- `services/domain/presentationRecipesIngredientUnitIdentity.ts` — ASCII C single-line normalize (C-end trim; preserve NBSP; refuse em-space/NBSP padding inventing; full C0/DEL reject)
- `app/settings/recipes.tsx` — soft-null before RecipeRow quantityUnit / readOnlyAccessibility and RecipeBaselineBuilder unit preview
- `i18n/catalog.ts` — EN/ES/zh-Hans `recipes.ingredient.unit.none`
- Focused inventing/bypass tests + this report

## Ownership
Owns only Settings Recipes display `ingredient.unit` + builder selected inventory unit → `recipes.ingredient.unit.none`. Leaves Inventory detail unit (#1191), Inventory hub unit (#1192), Scan Item unit (#1193), RecommendationDecisionRow unit (#1194), Daily Report deliveries.line.unit (#1195), setup inventory units (#861), inventory recipe-mapping write units (#864 — including add-link `unit: selectedInventoryItem.unit`), Recipes ingredient.itemName (#1067), Recipes POS missing itemName (#1082), Recipes dish menu_item_name (#1080), and inventory unit client helpers (#669) alone.

## Inventing proof
- Prior always-pass `<Text style={styles.quantityUnit}>{ingredient.unit}</Text>`
- Prior always-pass `unit: ingredient.unit` in readOnlyAccessibility
- Prior builder preview `selectedInventoryItem?.unit ?? "--"` (Unicode-only-space bypasses nullish coalescing)
- Unicode-only-space blank-looking unit (`Boolean("\u2003") === true`)
- Unicode trim invents clean unit (`"\u2003cs\u2003".trim() === "cs"`)
- Soft-null restores localized `recipes.ingredient.unit.none` while sibling itemName / menu_item_name / write-path unit stay raw

## Verification
- Focused `tests/recipesIngredientUnitAsciiC.test.ts` 5/5 (66 assertion call sites counted from source)
- `npm run typecheck` passed
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited `withTimeout cancelledByParent`; fixed in #1183, not landed)
- No migration
