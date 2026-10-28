/**
 * Recipe-authority hydrate menuItemName identity helpers (MISE-005SW).
 *
 * Pins repository-layer `parseRecipeAuthorityState` `menuItemName` hydrate
 * outside `supabaseRepository` so Node tests can exercise inventing proofs
 * without loading Expo or Supabase RPCs. Prior path Unicode-trimmed hosted
 * recipe-authority `menuItemName` into durable `RecipeAuthorityState`
 * (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`). Soft-empty
 * Unicode-only padding also collapsed through `.trim()` into the intentional
 * invalid-response gate (`Recipe authority returned an invalid response.`).
 *
 * These are hosted recipe-authority **hydrate** menu-item name tokens only —
 * not application recipe-mapping write `menuItemName` (open #863 /
 * MISE-005QC), not demo recipe-baseline `menuItemName` (#905 / MISE-005RS),
 * not inventory recipe menu-item key folds (#678 / MISE-005JI), and not
 * `menuItemId` hydrate (left untrimmed on the existing contract). Soft empty /
 * Unicode-padded / control-bearing tokens fail closed so padded names cannot
 * invent reviewed durable recipe-authority display identity. Ordinary ASCII
 * whitespace still trims clean. Case and accents are left unchanged.
 *
 * Complements open inventory recipe-mapping tip #863 / MISE-005QC without
 * sharing that module or rewriting sibling `parseRecipeAuthorityState` fields
 * (`menuItemId`, revisions, readiness flags). Leave application
 * `addRecipeBaselineIngredient` and demo matching `.toLowerCase()` folds on
 * their existing tipped contracts.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized recipe-authority menu item name before it
 * is stored on durable `RecipeAuthorityState.menuItemName`.
 */
export function asciiTrimRecipeAuthorityMenuItemNameToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipe-authority menu item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipeAuthorityMenuItemNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimRecipeAuthorityMenuItemNameToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for hosted recipe-authority hydrate `menuItemName`.
 * Preserves soft empty → null (prior `.trim()` emptiness → invalid-response
 * gate) while refusing to invent a clean menu item name via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `!menuItemName` invalid-response gate owns the error.
 */
export function normalizeRecipeAuthorityMenuItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the invalid-response gate. Do not invent a name from
  // padding.
  if (!value.trim()) return null;
  return canonicalizeRecipeAuthorityMenuItemNameToken(value);
}
