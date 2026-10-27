/**
 * Setup-drafts recipe ingredient quantity identity helpers (MISE-005RK).
 *
 * Pins `services/domain/setupDrafts.ts` recipe ingredient `quantity` prep for
 * `recipeDraftsToBaselineText` (and matching recipe readiness / preview /
 * health emptiness gates that decide whether a quantity is present) outside
 * the React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed quantity into the
 * durable recipe baseline string used at setup save
 * (`'\u200312\u2003'.trim() === '12'` → `"Tomato 12 oz"`), so NBSP / em-space
 * padding invented a clean quantity the operator did not type as ordinary
 * ASCII digits. Unicode-only space also invented the soft-empty skip via
 * `'\u2003'.trim() === ''`.
 *
 * These are single-line setup-drafts recipe ingredient **quantity** tokens
 * only — not the setup.tsx validate/normalize locale `parseNumber` path (open
 * #896 / MISE-005RJ `setupRecipeIngredientQuantityIdentity.ts`), not setup
 * inventory on-hand quantity (open #895 / MISE-005RI), not setup inventory
 * `parLevel` (open #894 / MISE-005RH), not inventory detail settings /
 * operation quantities (open #893 / #892), not Log Delivery / inventory count /
 * Orders recommendation quantities (open #891 / #890 / #889), and not
 * free-form notes. Soft empty (ASCII whitespace or Unicode-only space) stays
 * soft `""` so callers keep the prior missing-quantity skip / not-ready
 * contract. Ordinary ASCII whitespace still trims clean before the baseline
 * string is built. Unicode-padded or control-bearing drafts soft to `""`
 * rather than inventing equality with the unpadded quantity.
 *
 * Complements open setup.tsx recipe ingredient quantity tip #896 / MISE-005RJ
 * without sharing that module. Locale parsing stays on the screen; this
 * module only refuses to invent a clean quantity token inside setup-drafts
 * baseline / readiness identity.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized setup-drafts recipe ingredient quantity
 * before it is written into the durable recipe baseline text.
 */
export function asciiTrimSetupDraftsRecipeIngredientQuantityText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup-drafts recipe ingredient quantity under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupDraftsRecipeIngredientQuantityText(
  value: string
): string | null {
  const trimmed = asciiTrimSetupDraftsRecipeIngredientQuantityText(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for setup-drafts recipe ingredient quantity identity.
 * Preserves soft empty → missing-quantity skip / not-ready while refusing to
 * invent a clean quantity via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizeSetupDraftsRecipeIngredientQuantityText(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior
  // `ingredient.quantity.trim()` emptied those into the missing-quantity skip.
  if (!value.trim()) return "";
  return canonicalizeSetupDraftsRecipeIngredientQuantityText(value) ?? "";
}
