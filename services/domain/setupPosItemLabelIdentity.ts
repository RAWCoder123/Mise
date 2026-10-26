/**
 * Setup POS CSV item-name / category identity helpers (MISE-005QL).
 *
 * Pins domain-layer guided POS import `itemName` / `category` prep outside the
 * repository graph so Node tests can exercise inventing proofs without loading
 * Supabase or AsyncStorage. The prior path Unicode-trimmed CSV cells and then
 * Unicode-trimmed the durable item / category strings before storing them on
 * the accepted import row and fingerprint component
 * (`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`,
 * `'\u00a0Mains\u00a0'.trim() === 'Mains'`).
 *
 * These are single-line scannable POS item / category identities, not
 * free-form multiline prose. Only ASCII end trim is pinned; case and accents
 * are left unchanged so presentation stays operator-faithful. Soft empty
 * (ASCII whitespace or Unicode-only space) stays soft `""` so:
 * - empty / padded-empty `itemName` keeps the live
 *   `if (!itemName) … "Add the POS item or dish name."` review path; and
 * - empty / padded-empty `category` keeps the live `|| "Sales"` fallthrough.
 * Unicode-padded non-empty tokens soft to `""` rather than inventing equality
 * with the unpadded label.
 *
 * Complements open setupDrafts header/fingerprint tip #676 / MISE-005JG,
 * setup POS saleDate tip #871 / MISE-005QK, Insights sales aggregation-label
 * tip #869 / MISE-005QI, setup recipe dish-name tip #862 / MISE-005QB, and
 * inventory recipe menu-item tip #863 / MISE-005QC without sharing those
 * modules or rewriting saleDate / quantity / grossSales / header normalize on
 * this path.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized setup POS item or category label before it
 * is stored on the accepted import row and fingerprint.
 */
export function asciiTrimSetupPosItemLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup POS CSV item-name or category label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeSetupPosItemLabel(value: string): string | null {
  const trimmed = asciiTrimSetupPosItemLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for guided POS CSV `itemName` / `category` identity.
 * Preserves soft empty → item_name review / category `"Sales"` fallthrough
 * while refusing to invent a clean label via Unicode em-space / NBSP trim.
 * Non-string, control-bearing, and Unicode-padded tokens soft to `""`.
 */
export function normalizeSetupPosItemLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and failed the item_name check or fell through to "Sales".
  if (!value.trim()) return "";
  return canonicalizeSetupPosItemLabel(value) ?? "";
}
