/**
 * Setup-drafts recipe ingredient unit identity helpers (MISE-005RM).
 *
 * Pins `services/domain/setupDrafts.ts` recipe ingredient `unit` prep for
 * `recipeDraftsToBaselineText` (and matching recipe readiness / preview /
 * health emptiness gates that decide whether a unit is present) outside the
 * React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed unit into the durable
 * recipe baseline string used at setup save
 * (`'\u2003oz\u2003'.trim() === 'oz'` → `"Tomato 12 oz"`), so NBSP / em-space
 * padding invented a clean unit the operator did not type as ordinary ASCII
 * text. Unicode-only space also invented the soft-empty skip via
 * `'\u2003'.trim() === ''`.
 *
 * These are single-line setup-drafts recipe ingredient **unit** tokens only —
 * not setup-drafts recipe ingredient itemName (open #898 / MISE-005RL
 * `setupDraftsRecipeIngredientItemNameIdentity.ts`), not setup-drafts recipe
 * ingredient quantity (open #897 / MISE-005RK
 * `setupDraftsRecipeIngredientQuantityIdentity.ts`), not the setup.tsx
 * validate/normalize recipe ingredient quantity path (open #896 / MISE-005RJ),
 * not setup inventory unit (open #861 / MISE-005QA
 * `setupInventoryUnitIdentity.ts`), not setup recipe dish names (open #862 /
 * MISE-005QB), and not free-form notes. Soft empty (ASCII whitespace or
 * Unicode-only space) stays soft `""` so callers keep the prior missing-unit
 * skip / not-ready contract. Ordinary ASCII whitespace still trims clean
 * before the baseline string is built. Unicode-padded or control-bearing
 * drafts soft to `""` rather than inventing equality with the unpadded unit.
 *
 * Complements open setup-drafts itemName tip #898 / MISE-005RL and quantity tip
 * #897 / MISE-005RK without sharing those modules. Leave setup.tsx
 * `ingredient.unit.trim()` validation, application
 * `ingredient.unit.trim() || "unit"`, and inventory `item.unit.trim()` alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-drafts recipe ingredient unit before
 * it is written into the durable recipe baseline text.
 */
export function asciiTrimSetupDraftsRecipeIngredientUnitText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-drafts recipe ingredient unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupDraftsRecipeIngredientUnitText(
  value: string
): string | null {
  const trimmed = asciiTrimSetupDraftsRecipeIngredientUnitText(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for setup-drafts recipe ingredient unit identity.
 * Preserves soft empty → missing-unit skip / not-ready while refusing to
 * invent a clean unit via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizeSetupDraftsRecipeIngredientUnitText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior
  // `ingredient.unit.trim()` emptied those into the missing-unit skip.
  if (!value.trim()) return "";
  return canonicalizeSetupDraftsRecipeIngredientUnitText(value) ?? "";
}
