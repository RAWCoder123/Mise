# MISE-005UY recipe-authority hydrate menuItemId ASCII C

Date: 2026-10-31  
Branch: `cursor/mise-recipe-authority-menu-item-id-ascii-c`  
Base: `origin/main` @ `78da737`

## Inventing proof

Repository `parseRecipeAuthorityState` accepted raw hosted `menuItemId` strings into durable `RecipeAuthorityState`. Em-space / NBSP padding stayed truthy through the empty gate (`Boolean("\u2003menu_item_margherita\u2003") === true`) and Unicode `.trim()` invents a clean durable id (`"\u2003menu_item_margherita\u2003".trim() === "menu_item_margherita"`).

## Change

- Add `services/repositories/recipeAuthorityMenuItemIdIdentity.ts` (ASCII end trim; soft-null Unicode padding / controls / non-string)
- Route `services/repositories/supabaseRepository.ts` `parseRecipeAuthorityState` `menuItemId` through `normalizeRecipeAuthorityMenuItemId`
- Soft empty / Unicode-padded → `""` so existing `Recipe authority returned an invalid response.` gate fails closed
- Leave hydrate `menuItemName` Unicode `.trim()` alone (open #935 / MISE-005SW)

## Ownership

Owns hosted recipe-authority hydrate **menuItemId** only. Does **not** own hydrate menuItemName (#935), application recipe-mapping write menuItemName (#863), demo recipe-baseline menu-item identity (#905), inventory recipe menu-item keys (#678), or verified-provider location hydrate (#936).

## Merge note

Alone-OK with #935 / #863 / #905 / #678 / #936. Keep `recipeAuthorityMenuItemIdIdentity.ts` separate. When landing with #935, drop #935's assertion that `menuItemId` still uses the bare `typeof … ? payload.menuItemId : ""` contract once this tip owns that hydrate; drop this tip's assertion that `menuItemName` still Unicode-trims once #935 owns that path.
