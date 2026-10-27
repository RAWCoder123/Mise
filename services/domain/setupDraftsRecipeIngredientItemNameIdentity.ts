/**
 * Setup-drafts recipe ingredient itemName identity helpers (MISE-005RL).
 *
 * Pins `services/domain/setupDrafts.ts` recipe ingredient `itemName` prep for
 * `recipeDraftsToBaselineText` (and matching recipe readiness / preview /
 * health emptiness gates that decide whether an item name is present) outside
 * the React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed itemName into the
 * durable recipe baseline string used at setup save
 * (`'\u2003Tomato\u2003'.trim() === 'Tomato'` → `"Tomato 12 oz"`), so NBSP /
 * em-space padding invented a clean ingredient name the operator did not type
 * as ordinary ASCII text. Unicode-only space also invented the soft-empty skip
 * via `'\u2003'.trim() === ''`.
 *
 * These are single-line setup-drafts recipe ingredient **itemName** tokens
 * only — not setup-drafts recipe ingredient quantity (open #897 / MISE-005RK
 * `setupDraftsRecipeIngredientQuantityIdentity.ts`), not the setup.tsx
 * validate/normalize recipe ingredient quantity path (open #896 / MISE-005RJ),
 * not setup inventory on-hand quantity / parLevel (open #895 / #894), not
 * setup recipe dish names (open #862 / MISE-005QB), not setup inventory unit
 * (open #861 / MISE-005QA), not application setup inventory-name key matching
 * (open #679 / MISE-005JJ), and not free-form notes. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft `""` so callers keep the prior
 * missing-itemName skip / not-ready contract. Ordinary ASCII whitespace still
 * trims clean before the baseline string is built. Unicode-padded or
 * control-bearing drafts soft to `""` rather than inventing equality with the
 * unpadded item name.
 *
 * Complements open setup-drafts quantity tip #897 / MISE-005RK without sharing
 * that module. Leave setup.tsx `ingredient.itemName.trim()` validation and
 * application `ingredient.itemName.trim()` lookup alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-drafts recipe ingredient itemName
 * before it is written into the durable recipe baseline text.
 */
export function asciiTrimSetupDraftsRecipeIngredientItemNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-drafts recipe ingredient itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupDraftsRecipeIngredientItemNameText(
  value: string
): string | null {
  const trimmed = asciiTrimSetupDraftsRecipeIngredientItemNameText(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for setup-drafts recipe ingredient itemName identity.
 * Preserves soft empty → missing-itemName skip / not-ready while refusing to
 * invent a clean item name via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizeSetupDraftsRecipeIngredientItemNameText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior
  // `ingredient.itemName.trim()` emptied those into the missing-itemName skip.
  if (!value.trim()) return "";
  return canonicalizeSetupDraftsRecipeIngredientItemNameText(value) ?? "";
}
