/**
 * Setup recipe ingredient itemName save identity helpers (MISE-005RP).
 *
 * Pins application-layer `saveRestaurantSetup` recipe ingredient `itemName`
 * text outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or demo storage. Setup recipe ingredients
 * previously Unicode-trimmed on persist (`ingredient.itemName.trim()`), so
 * NBSP/em-space padding invented a clean durable inventory / mapping name
 * before recipe-baseline inventory rows and recipe mappings stored it
 * (`'\u2003Tomato\u2003'.trim() === 'Tomato'`). Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional skip
 * (`if (!ingredientName || quantityUsedPerSale <= 0) continue`).
 *
 * Complements open setup.tsx recipe ingredient itemName tip #901 /
 * MISE-005RO, setup-drafts recipe ingredient itemName tip #898 /
 * MISE-005RL, setup recipe dishName tip #862 / MISE-005QB, and setup
 * inventory / recipe unit tip #861 / MISE-005QA without sharing those
 * modules or rewriting sibling save field trims (inventory draft names
 * #679, units #861, dishName #862, attachment labels, restaurantId,
 * supplier emptiness). Those remain on their existing contracts in this tip.
 *
 * Ingredient item names are single-line recipe / inventory identity text,
 * not free-form multiline prose. Only ASCII end trim is pinned; case and
 * accents are left unchanged so presentation stays operator-faithful. Soft
 * empty (ASCII whitespace or Unicode-only space) stays soft-null so save
 * can skip the ingredient without inventing a name from padding.
 * Unicode-padded non-empty tokens fail closed rather than inventing
 * equality with the unpadded ingredient name.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup recipe ingredient itemName before
 * it is stored as durable inventory / recipe-mapping identity.
 */
export function asciiTrimSetupRecipeIngredientItemNameSaveToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup recipe ingredient itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupRecipeIngredientItemNameSaveToken(
  value: string
): string | null {
  const trimmed = asciiTrimSetupRecipeIngredientItemNameSaveToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null (prior
 * `.trim()` skip emptiness) while refusing to invent a clean ingredient
 * name via Unicode em-space trim. Does not throw; Unicode-padded
 * non-empty tokens return null so the live fail-closed normalize owns
 * the error.
 */
export function canonicalizeSetupRecipeIngredientItemNameSave(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent an ingredient name from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupRecipeIngredientItemNameSaveToken(value);
}

/**
 * Fail-closed ingredient itemName normalize for `saveRestaurantSetup` and
 * inventing proofs. Soft empty → null so save can skip the ingredient.
 * Unicode-padded / unsafe-control / non-string tokens fail closed.
 *
 * Error contract: `Setup recipe ingredient item name is invalid.`
 */
export function normalizeCanonicalSetupRecipeIngredientItemNameSave(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Setup recipe ingredient item name is invalid.");
  }
  const canonical = canonicalizeSetupRecipeIngredientItemNameSaveToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Setup recipe ingredient item name is invalid.");
}

/**
 * Fail-closed ingredient itemName require for inventing proofs where a
 * present name must already be canonical. Soft empty fails closed rather
 * than inventing a skip-time empty string on read.
 */
export function requireCanonicalSetupRecipeIngredientItemNameSave(
  value: unknown
): string {
  const canonical = normalizeCanonicalSetupRecipeIngredientItemNameSave(value);
  if (!canonical) {
    throw new Error("Setup recipe ingredient item name is invalid.");
  }
  return canonical;
}
