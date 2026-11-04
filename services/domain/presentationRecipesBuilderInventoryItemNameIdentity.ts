/**
 * Recipes Settings builder inventory SuggestionChip item.item_name identity
 * helpers (MISE-005XW).
 *
 * Pins the Settings → Recipes builder inventory suggestion chips that
 * previously always passed raw `item.item_name` into SuggestionChip labels:
 * `label={item.item_name}`
 *
 * A Unicode-only-space inventory item name (`"\u2003"`) is non-nullish and
 * truthy as an InventoryItem.item_name field, so the builder chips still
 * rendered a blank-looking inventory-item identity with no intentional
 * localized fallback. Empty string has the same blank-looking path.
 * Separately, Unicode `.trim()` on a padded inventory item name
 * (`"\u2003Avocado\u2003".trim() === "Avocado"`) would invent a clean display
 * inventory-item identity if that gate Unicode-trimmed before interpolating
 * into the builder SuggestionChip chrome.
 *
 * Single-line inventory-item-name tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded inventory item name. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist) because this
 * token is rendered into single-line SuggestionChip labels.
 *
 * These are presentation **recipes.builder.inventoryItemName.none** tokens
 * only — the builder inventory SuggestionChip labels that fall through to
 * that fallback when soft-null. Not Recipes POS missing-recipe badge /
 * builder-missing chip itemName (#1082 / MISE-005XV), not
 * recipes.notice.linked ingredient/dish (#1081 / MISE-005XU), not Recipes
 * dish menu_item_name / recipes.notice.confirmed (#1080 / MISE-005XT), not
 * Recipes ingredient.itemName row chrome (#1067 / MISE-005XG), not
 * recipe-baseline inventory itemName (#1035 / MISE-005WA), not Inventory hub
 * item.item_name (#1056 / MISE-005WV), not React list keys (`item.id`), not
 * SuggestionChip onPress write-back of the raw inventory item name, and not
 * the builder selectedInventoryItem Unicode-trim equality gate. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("recipes.builder.inventoryItemName.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1082 / #1081 / #1080 / #1067 / #1056 / #1035 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Recipes builder inventory SuggestionChip
 * item name before it is rendered into SuggestionChip labels.
 */
export function asciiTrimRecipesBuilderInventoryItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Recipes builder inventory SuggestionChip item name under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipesBuilderInventoryItemName(value: string): string | null {
  const trimmed = asciiTrimRecipesBuilderInventoryItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Recipes builder inventory SuggestionChip `item.item_name`
 * display. Preserves soft empty → null (intentional localized
 * recipes.builder.inventoryItemName.none copy) while refusing to invent a
 * clean inventory item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("recipes.builder.inventoryItemName.none")` branch owns the fallback
 * without inventing a clean builder chip label from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking inventory item through the prior always-pass-name chrome.
 */
export function normalizeRecipesBuilderInventoryItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into builder inventory SuggestionChips as a
  // blank-looking inventory-item identity.
  // Do not invent a clean Recipes builder inventory SuggestionChip item name
  // from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipesBuilderInventoryItemName(value);
}
