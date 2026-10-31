/**
 * Recipe-authority hydrate menuItemId identity helpers (MISE-005UY).
 *
 * Pins repository-layer `parseRecipeAuthorityState` `menuItemId` hydrate
 * outside `supabaseRepository` so Node tests can exercise inventing proofs
 * without loading Expo or Supabase RPCs. Prior path accepted raw hosted
 * recipe-authority `menuItemId` strings into durable `RecipeAuthorityState`.
 * Em-space / NBSP padding stayed truthy through the empty gate
 * (`Boolean("\u2003item-1\u2003") === true`) and would invent a clean durable
 * id under Unicode `.trim()` (`"\u2003item-1\u2003".trim() === "item-1"`) —
 * the same inventing class sibling hydrate tip #935 / MISE-005SW already
 * closed for `menuItemName`.
 *
 * These are hosted recipe-authority **hydrate** menu-item id tokens only —
 * not hydrate `menuItemName` (open #935 / MISE-005SW), not application
 * recipe-mapping write `menuItemName` (open #863 / MISE-005QC), not demo
 * recipe-baseline menu-item identity (#905 / MISE-005RS), and not inventory
 * recipe menu-item key folds (#678 / MISE-005JI). Soft empty / Unicode-padded
 * / control-bearing tokens fail closed so padded ids cannot invent reviewed
 * durable recipe-authority object identity. Ordinary ASCII whitespace still
 * trims clean. Case is left unchanged.
 *
 * Complements open recipe-authority hydrate tip #935 / MISE-005SW without
 * sharing that module or rewriting sibling `parseRecipeAuthorityState` fields
 * (`menuItemName`, revisions, readiness flags).
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized recipe-authority menu item id before it
 * is stored on durable `RecipeAuthorityState.menuItemId`.
 */
export function asciiTrimRecipeAuthorityMenuItemIdToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a recipe-authority menu item id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeRecipeAuthorityMenuItemIdToken(
  value: string
): string | null {
  const trimmed = asciiTrimRecipeAuthorityMenuItemIdToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for hosted recipe-authority hydrate `menuItemId`.
 * Preserves soft empty → null (prior emptiness → invalid-response gate) while
 * refusing to invent a clean menu item id via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `!menuItemId` invalid-response gate owns the error.
 */
export function normalizeRecipeAuthorityMenuItemId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior raw truthy
  // padding bypassed the empty gate. Do not invent an id from padding.
  if (!value.trim()) return null;
  return canonicalizeRecipeAuthorityMenuItemIdToken(value);
}
