/**
 * Setup inventory unit identity helpers (MISE-005QA).
 *
 * Pins application-layer `saveRestaurantSetup` inventory draft and recipe
 * ingredient unit text outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Setup units
 * previously Unicode-trimmed on persist (`draft.unit.trim() || "unit"` and
 * `ingredient.unit.trim() || "unit"`), so NBSP/em-space padding invented a
 * clean durable unit before inventory / recipe baseline rows stored it
 * (`'\u2003lb\u2003'.trim() || "unit" === 'lb'`). Soft-empty Unicode-only
 * padding also collapsed through `.trim()` into the intentional `"unit"`
 * default.
 *
 * Complements open inventory_items.unit SQL cntrl pin #586 / MISE-005FV,
 * inventoryUnits client fold #669 / MISE-005JA, and operationalMapping unit
 * tip #709 / MISE-005KN without sharing those modules or rewriting sibling
 * setup draft field trims (name keys #679, attachment labels #843, restaurant
 * workspace #742, referenceId #769, supplier name/email #680, dishName). Those
 * remain on their existing contracts in this tip.
 *
 * Setup units are single-line inventory/recipe unit identity text, not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) stays soft-null so save can fall
 * through to the prior `"unit"` default without inventing that default from a
 * padded real token. Unicode-padded non-empty tokens fail closed rather than
 * inventing equality with the unpadded unit.
 */

export const SETUP_INVENTORY_UNIT_DEFAULT = "unit";

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup inventory unit before it is
 * stored as durable inventory / recipe baseline identity.
 */
export function asciiTrimSetupInventoryUnitToken(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupInventoryUnitToken(
  value: string
): string | null {
  const trimmed = asciiTrimSetupInventoryUnitToken(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft canonicalize for callers that preserve soft empty → null (prior
 * `.trim() || "unit"` emptiness) while refusing to invent a clean unit via
 * Unicode em-space trim. Does not throw; Unicode-padded non-empty tokens
 * return null so the live fail-closed normalize owns the error.
 */
export function canonicalizeSetupInventoryUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a unit from padding.
  if (!value.trim()) return null;
  return canonicalizeSetupInventoryUnitToken(value);
}

/**
 * Fail-closed unit normalize for `saveRestaurantSetup` and inventing proofs.
 * Soft empty → null so save can apply the `"unit"` default.
 * Unicode-padded / unsafe-control / non-string tokens fail closed.
 *
 * Error contract: `Setup inventory unit is invalid.`
 */
export function normalizeCanonicalSetupInventoryUnit(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Setup inventory unit is invalid.");
  }
  const canonical = canonicalizeSetupInventoryUnitToken(value);
  if (canonical) return canonical;
  // Preserve soft empty (ASCII whitespace or Unicode-only space) → null.
  if (!value.trim()) return null;
  throw new Error("Setup inventory unit is invalid.");
}

/**
 * Fail-closed unit require for inventing proofs where a present unit must
 * already be canonical. Soft empty fails closed rather than inventing the
 * save-time `"unit"` default on read.
 */
export function requireCanonicalSetupInventoryUnit(value: unknown): string {
  const canonical = normalizeCanonicalSetupInventoryUnit(value);
  if (!canonical) {
    throw new Error("Setup inventory unit is invalid.");
  }
  return canonical;
}
