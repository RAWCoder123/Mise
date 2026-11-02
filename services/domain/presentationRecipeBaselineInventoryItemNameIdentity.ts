/**
 * Recipe-baseline inventory itemName identity helpers (MISE-005WA).
 *
 * Pins miseDomain `buildRecipeBaselineSummary` inventory display that
 * previously selected ingredient `itemName` / `linkedInventoryItems` labels
 * with a raw nullish-coalescing gate:
 *
 * ```ts
 * itemNames.get(mapping.inventory_item_id) ?? "Inventory item"
 * ```
 *
 * A Unicode-only-space inventory `item_name` (`"\u2003"`) is non-nullish under
 * `??`, so Settings Recipes ingredient rows and linked-inventory labels stored
 * the padding (or bypassed the intentional hard-coded `"Inventory item"` empty
 * state) instead of failing closed. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on a padded
 * inventory name (`"\u2003Chicken breast\u2003".trim() === "Chicken breast"`)
 * would invent a clean inventory display identity before it is rendered into
 * recipe-baseline ingredient rows / a11y labels.
 *
 * Single-line inventory item-name tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded inventory name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are miseDomain **recipe-baseline inventory itemName** tokens only —
 * the `buildRecipeBaselineSummary` path that falls through to
 * `"Inventory item"`. Not Inventory detail Screen title item_name
 * (#1017 / MISE-005VI), not waste.event.unknownItem itemName
 * (#1018 / MISE-005VJ), not demo recipe-baseline ingredient-entry parse
 * (#906 / MISE-005RT), not setup-drafts recipe ingredient itemName
 * (#898 / MISE-005RL), not activityEvents hard-coded English
 * `itemName ?? "Inventory"`, and not setup validation
 * `item.name || "Inventory item"` error labels. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `"Inventory item"` branch owns the intentional empty state. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #1018 / #1017 / #906 / #898 without sharing those modules
 * or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized recipe-baseline inventory item name before
 * it is rendered into Settings Recipes ingredient rows.
 */
export function asciiTrimRecipeBaselineInventoryItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipe-baseline inventory itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipeBaselineInventoryItemName(value: string): string | null {
  const trimmed = asciiTrimRecipeBaselineInventoryItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one recipe-baseline inventory itemName candidate.
 * Preserves soft empty → null (intentional hard-coded `"Inventory item"` copy)
 * while refusing to invent a clean inventory name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `"Inventory item"` branch owns the fallback without
 * inventing a clean inventory name from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass `"Inventory item"`
 * through the prior `??` row.
 */
export function normalizeRecipeBaselineInventoryItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed `"Inventory item"` via `??`. Do not invent a clean
  // recipe-baseline inventory item name from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipeBaselineInventoryItemName(value);
}
