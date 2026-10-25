/**
 * Setup recipe dish-name identity helpers (MISE-005QB).
 *
 * Pins application-layer `saveRestaurantSetup` recipe `dishName` text outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Setup recipes previously Unicode-trimmed
 * on persist (`recipe.dishName.trim()`), so NBSP/em-space padding invented a
 * clean durable menu item name before recipe mappings stored it
 * (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`). Soft-empty
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * skip (`if (!menuItemName) continue`).
 *
 * Complements open menu_item_ingredients.menu_item_name SQL cntrl pin #599 /
 * MISE-005GI, inventory recipe menu-item key tip #678 / MISE-005JI, and setup
 * inventory-name key tip #679 / MISE-005JJ without sharing those modules or
 * rewriting sibling setup draft field trims (inventory/recipe units #861,
 * attachment labels #843, restaurant workspace #742, referenceId #769,
 * supplier name/email #680, inventory draft names / ingredient itemName).
 * Those remain on their existing contracts in this tip. setupDrafts
 * presentation emptiness checks that call `dishName.trim()` are left alone.
 *
 * Dish names are single-line recipe / menu-item identity text, not free-form
 * multiline prose. Only ASCII end trim is pinned; case and accents are left
 * unchanged so presentation stays operator-faithful. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft-null so save can skip the
 * recipe without inventing a menu item name from padding. Unicode-padded
 * non-empty tokens fail closed rather than inventing equality with the
 * unpadded dish name. Hosted writers already bound menu_item_name to 1..200;
 * this tip does not invent a new client length gate.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup recipe dish name before it is
 * stored as durable menu_item_name identity.
 */
export function asciiTrimSetupRecipeDishNameToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup recipe dish name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupRecipeDishNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimSetupRecipeDishNameToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null (prior
 * `.trim()` skip emptiness) while refusing to invent a clean dish name via
 * Unicode em-space trim. Does not throw; Unicode-padded non-empty tokens
 * return null so the live fail-closed normalize owns the error.
 */
export function canonicalizeSetupRecipeDishName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a dish name from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupRecipeDishNameToken(value);
}

/**
 * Fail-closed dish-name normalize for `saveRestaurantSetup` and inventing
 * proofs. Soft empty → null so save can skip the recipe.
 * Unicode-padded / unsafe-control / non-string tokens fail closed.
 *
 * Error contract: `Setup recipe dish name is invalid.`
 */
export function normalizeCanonicalSetupRecipeDishName(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Setup recipe dish name is invalid.");
  }
  const canonical = canonicalizeSetupRecipeDishNameToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Setup recipe dish name is invalid.");
}

/**
 * Fail-closed dish-name require for inventing proofs where a present dish
 * name must already be canonical. Soft empty fails closed rather than
 * inventing a skip-time empty string on read.
 */
export function requireCanonicalSetupRecipeDishName(value: unknown): string {
  const canonical = normalizeCanonicalSetupRecipeDishName(value);
  if (!canonical) {
    throw new Error("Setup recipe dish name is invalid.");
  }
  return canonical;
}
