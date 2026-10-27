/**
 * Setup-drafts recipe dishName identity helpers (MISE-005RN).
 *
 * Pins `services/domain/setupDrafts.ts` recipe `dishName` prep for
 * `recipeDraftsToBaselineText` (and matching recipe readiness / preview /
 * health emptiness gates that decide whether a dish name is present) outside
 * the React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed dishName into the
 * durable recipe baseline string used at setup save
 * (`'\u2003Margherita\u2003'.trim() === 'Margherita'` → `"Margherita: Tomato 12 oz"`),
 * so NBSP / em-space padding invented a clean dish token the operator did not
 * type as ordinary ASCII text. Unicode-only space also invented the soft-empty
 * skip via `'\u2003'.trim() === ''`.
 *
 * These are single-line setup-drafts recipe **dishName** tokens only — not the
 * application-layer setup recipe dishName save path (open #862 / MISE-005QB
 * `setupRecipeDishNameIdentity.ts`), not setup-drafts recipe ingredient
 * itemName (open #898 / MISE-005RL), not setup-drafts recipe ingredient
 * quantity (open #897 / MISE-005RK), not setup-drafts recipe ingredient unit
 * (open #899 / MISE-005RM), and not free-form notes. Soft empty (ASCII
 * whitespace or Unicode-only space) stays soft `""` so callers keep the prior
 * missing-dish skip / not-ready contract. Ordinary ASCII whitespace still
 * trims clean before the baseline string is built. Unicode-padded or
 * control-bearing drafts soft to `""` rather than inventing equality with the
 * unpadded dish name.
 *
 * Complements open application dishName tip #862 / MISE-005QB without sharing
 * that module. Leave setup-drafts ingredient itemName / quantity / unit bare
 * trim contracts to their open tips, and leave the application save-path
 * dishName canonicalize alone.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-drafts recipe dishName before it is
 * written into the durable recipe baseline text.
 */
export function asciiTrimSetupDraftsRecipeDishNameText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-drafts recipe dishName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupDraftsRecipeDishNameText(
  value: string
): string | null {
  const trimmed = asciiTrimSetupDraftsRecipeDishNameText(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for setup-drafts recipe dishName identity.
 * Preserves soft empty → missing-dish skip / not-ready while refusing to
 * invent a clean dish name via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizeSetupDraftsRecipeDishNameText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior
  // `recipe.dishName.trim()` emptied those into the missing-dish skip.
  if (!value.trim()) return "";
  return canonicalizeSetupDraftsRecipeDishNameText(value) ?? "";
}
