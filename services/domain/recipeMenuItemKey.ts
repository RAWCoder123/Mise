/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JS). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a recipe menu-item match
 * the hosted COLLATE C path would refuse.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Collapse only ASCII whitespace so recipe menu-item identity stays
 * aligned with server helpers pinned under COLLATE "C". Complements
 * client tip MISE-005JI (#678) for the operational-workflows edge path.
 */
export function normalizeRecipeMenuItemKey(value: string) {
  return asciiCLower(value)
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "")
    .replace(/[ \t\n\r\f\v]+/g, " ");
}

export function recipeMenuItemKeysMatch(left: string, right: string) {
  return normalizeRecipeMenuItemKey(left) === normalizeRecipeMenuItemKey(right);
}
