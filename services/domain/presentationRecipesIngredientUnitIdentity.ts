/**
 * Settings Recipes ingredient / builder unit identity helpers (MISE-005ABI).
 *
 * Pins the Settings Recipes free-form unit interpolations that previously
 * always passed raw units into quantity suffixes, read-only accessibility
 * labels, and the builder unit preview whenever a recipe ingredient row or
 * selected inventory item existed:
 *   `{ingredient.unit}` in `styles.quantityUnit`
 *   `t("recipes.row.readOnlyAccessibility", { unit: ingredient.unit })`
 *   `{selectedInventoryItem?.unit ?? "--"}` in the builder unit preview
 *
 * A Unicode-only-space unit (`"\u2003"`) is non-nullish and truthy as an
 * ingredient / inventory-item field, so Recipes still rendered blank-looking
 * unit identity beside quantities (`"1.5  "`), inside read-only a11y shells
 * (`"Chicken: 1.5   per sale"`), and in the builder preview via `?? "--"`
 * (Unicode-only-space bypasses nullish coalescing). Empty string has the same
 * blank-looking unit path. Separately, Unicode `.trim()` on a padded unit
 * (`"\u2003cs\u2003".trim() === "cs"`) would invent a clean display unit
 * identity if that gate Unicode-trimmed before interpolating into Recipes
 * unit copy.
 *
 * Single-line unit tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded unit. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **recipes.ingredient.unit.none** unit tokens only —
 * the Settings Recipes display `ingredient.unit` / selected inventory unit
 * that falls through to that fallback when soft-null. Not Inventory detail
 * display unit (#1191 / MISE-005AAF), not Inventory hub unit (#1192 /
 * MISE-005AAG), not Scan Item quantity unit (#1193 / MISE-005AAH), not
 * RecommendationDecisionRow suggested unit (#1194 / MISE-005AAI), not Daily
 * Report deliveries.line.unit (#1195 / MISE-005AAJ), not setup inventory
 * units (#861 / MISE-005QA), not inventory recipe-mapping write units (#864 /
 * MISE-005QD), not Recipes ingredient.itemName (#1067 / MISE-005XG), not
 * Recipes POS missing-recipe badge itemName (#1082 / MISE-005XV), not
 * Recipes dish menu_item_name (#1080 / MISE-005XT), not inventory unit
 * client helpers (#669 / MISE-005JA), and not controlled inventory.ops.unit
 * canonical labels. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `|| t("recipes.ingredient.unit.none")` branch owns
 * the intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1191 / #1192 / #1193 / #1194 / #1195 / #861 / #864 /
 * #1067 / #1082 / #1080 / #669 without sharing those modules or rewriting
 * their call sites. Leaves the add-link write path
 * `unit: selectedInventoryItem.unit` alone for #864.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Settings Recipes unit before it is
 * rendered into quantity suffixes, read-only a11y, or the builder preview.
 */
export function asciiTrimRecipesIngredientUnit(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings Recipes ingredient / builder unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesIngredientUnit(value: string): string | null {
  const trimmed = asciiTrimRecipesIngredientUnit(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Settings Recipes `ingredient.unit` /
 * `selectedInventoryItem.unit` display.
 * Preserves soft empty → null (intentional localized
 * recipes.ingredient.unit.none copy) while refusing to invent a clean unit
 * via Unicode em-space / NBSP trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live
 * `|| t("recipes.ingredient.unit.none")` branch owns the fallback without
 * inventing a clean Settings Recipes unit from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking unit
 * through the prior always-pass quantityUnit / readOnlyAccessibility /
 * builder preview path.
 */
export function normalizeRecipesIngredientUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Recipes quantityUnit / a11y / preview as a
  // blank-looking unit identity (and bypassed `?? "--"`).
  // Do not invent a clean Settings Recipes unit from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesIngredientUnit(value);
}
