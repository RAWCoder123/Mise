/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JT). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a recipes-settings
 * inventory or menu name match the hosted COLLATE C path would refuse.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Trim only ASCII whitespace so recipes-settings name keys stay aligned
 * with server helpers that btrim under COLLATE "C".
 */
function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Recipes-settings inventory and menu name identity key used to select
 * suggestion chips and resolve typed inventory names on
 * `app/settings/recipes.tsx`.
 */
export function normalizeRecipeSettingsNameKey(value: string) {
  return asciiCLower(asciiCTrim(value));
}

export function recipeSettingsNameKeysMatch(left: string, right: string) {
  return normalizeRecipeSettingsNameKey(left) === normalizeRecipeSettingsNameKey(right);
}

/** ASCII-only leading/trailing whitespace trim for persisted menu names. */
export function trimRecipeSettingsMenuItemName(value: string) {
  return asciiCTrim(value);
}
