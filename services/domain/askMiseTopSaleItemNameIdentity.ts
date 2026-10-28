/**
 * Ask Mise sales-answer top-sale item-name identity helpers (MISE-005SY).
 *
 * Pins AI-layer `answerAskMise` sales-intent `topItems[0].item_name` prep
 * outside the Expo UI graph so Node tests can exercise inventing proofs
 * without loading React Native. The prior path Unicode-trimmed the top POS
 * sale item name before interpolating it into the operator-facing
 * `ask.answer.sales.topItem` clause
 * (`'\u2003Chicken Bowl\u2003'.trim() === 'Chicken Bowl'`), so NBSP/em-space
 * padding invented a clean top-item label in the grounded sales answer.
 * Soft-empty Unicode-only padding also collapsed through `.trim()` into the
 * intentional `topSale ? … : null` drop.
 *
 * These are single-line scannable POS sale item names used only for the Ask
 * Mise sales top-item answer clause — not the Ask Mise question classify /
 * question-identity path (#700 / #879), not pilot-readiness missing-recipe
 * sale item Set keys (#875 / MISE-005QO), not Insights sales aggregation
 * labels (#869 / MISE-005QI), and not operational-findings unmapped
 * menu-item names (#924 / MISE-005SL). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the existing `topSale ? … : null`
 * branch owns the drop without inventing a clean label. Ordinary ASCII
 * whitespace still trims clean. Case and accents are left unchanged.
 *
 * Complements open Ask Mise question tip #879 / MISE-005QS and intent
 * classify tip #700 / MISE-005KE without sharing those modules or rewriting
 * `classifyAskMiseIntent` / question hydrate. Complements open pilot
 * readiness sale item tip #875 / MISE-005QO without sharing that helper —
 * this tip owns only Ask Mise sales-answer top-sale `item_name`.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized top-sale item name before it is shown in
 * the Ask Mise sales answer.
 */
export function asciiTrimAskMiseTopSaleItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Ask Mise top-sale item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeAskMiseTopSaleItemName(value: string): string | null {
  const trimmed = asciiTrimAskMiseTopSaleItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Ask Mise sales-answer `topItems[0].item_name`.
 * Preserves soft empty → null (prior `.trim()` emptiness → `topSale ? … : null`
 * drop) while refusing to invent a clean item label via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `topSale ? … : null` branch owns the drop.
 */
export function normalizeAskMiseTopSaleItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional top-item clause drop. Do not invent
  // a top-sale item name from padding.
  if (!value.trim()) return null;
  return canonicalizeAskMiseTopSaleItemName(value);
}
