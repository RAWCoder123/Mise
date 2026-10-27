/**
 * Setup-drafts POS CSV quantitySold helpers (MISE-005RW).
 *
 * Pins `services/domain/setupDrafts.ts` `parseSetupPosSalesCsv` quantitySold
 * cell prep outside the React Native screen graph so Node tests can exercise
 * inventing proofs without loading Expo. The prior path Unicode-trimmed every
 * CSV cell (including quantitySold) and then ran `parseSetupNumber`, whose
 * `/[$,\s]/g` strip uses ECMAScript `\s` (NBSP / em-space) before `Number`
 * (`'\u20032\u2003'.trim() === '2'` /
 * `'\u20032\u2003'.replace(/[$,\s]/g, "") === '2'` → `Number(...) === 2`),
 * so NBSP / em-space padding invented a clean quantity_sold on accepted POS
 * sales rows and fingerprints. Unicode-only space also invented the empty /
 * NaN quantity_sold review branch via `'\u2003'.trim() === ''`.
 *
 * These are setup-drafts **POS CSV quantitySold cells** only — not grossSales
 * cell prep (still on `parseSetupNumber` / cell Unicode trim until its own
 * tip), not setup POS itemName / category (open #872 / MISE-005QL), not setup
 * POS saleDate (open #871 / MISE-005QK), not full-line trim (open #908 /
 * MISE-005RV), not setup-drafts recipe ingredient quantities (open #897 /
 * MISE-005RK), and not free-form notes. Soft empty (ASCII whitespace or
 * Unicode-only space) stays `empty` so callers keep the prior empty → NaN →
 * quantity_sold review contract. Ordinary ASCII whitespace still trims clean
 * before `$` / `,` / ASCII-space strip and `Number`. Unicode-padded,
 * control-bearing, or non-finite drafts fail closed as `invalid` so padded
 * `"2"` cannot invent an accepted quantity_sold.
 *
 * Complements open setup POS item/category tip #872 / MISE-005QL, saleDate tip
 * #871 / MISE-005QK, and POS CSV line tip #908 / MISE-005RV without sharing
 * those modules. Leave grossSales, itemName, category, saleDate, and full-line
 * prep alone until their own tips own those surfaces.
 */

export type SetupDraftsPosQuantitySoldPrep =
  | { status: "empty" }
  | { status: "ok"; quantity: number; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / ECMAScript `\s` would strip
 * NBSP / em-space padding and invent a normalized setup-drafts POS
 * quantitySold before durable accepted sales rows.
 */
export function asciiTrimSetupDraftsPosQuantitySoldText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Strip currency punctuation and ASCII whitespace only. Do not use ECMAScript
 * `\s` — that class includes NBSP / em-space and would invent a clean numeric
 * token after end-padding survives ASCII trim.
 */
function stripAsciiCurrencyNoise(value: string) {
  return value.replace(/[$, \t\n\r\f\v]/g, "");
}

/**
 * Canonicalize a setup-drafts POS CSV quantitySold cell under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing / non-finite, otherwise `ok` with the
 * ASCII-trimmed display text and finite quantity.
 */
export function canonicalizeSetupDraftsPosQuantitySoldText(
  value: string
): SetupDraftsPosQuantitySoldPrep {
  const trimmed = asciiTrimSetupDraftsPosQuantitySoldText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  const normalized = stripAsciiCurrencyNoise(trimmed);
  if (!normalized) return { status: "empty" };
  const quantity = Number(normalized);
  if (!Number.isFinite(quantity)) return { status: "invalid" };
  return { status: "ok", quantity, text: trimmed };
}

/**
 * Soft normalize for setup-drafts POS CSV quantitySold parse.
 * Preserves soft empty → `empty` (prior cell `.trim()` / `parseSetupNumber`
 * empty → NaN → quantity_sold review) while refusing to invent a clean
 * quantity via Unicode em-space / NBSP trim or `\s` currency strip.
 * Non-string and control-bearing / padded / malformed tokens are `invalid`.
 */
export function prepareSetupDraftsPosQuantitySoldText(
  value: unknown
): SetupDraftsPosQuantitySoldPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior cell `.trim()`
  // emptied those into the NaN → quantity_sold review branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupDraftsPosQuantitySoldText(value);
}
