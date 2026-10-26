/**
 * Supplier-order draft line display helpers (MISE-005RA).
 *
 * Pins `utils/orderPresentation.ts` `scanSupplierOrderLines` line prep outside
 * the presentation util graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed each raw message line
 * and each captured `itemName` / `quantityLabel` before emptiness checks,
 * non-item header skips, dash matching, and stored draft-line identity
 * (`'\u2003Roma tomatoes\u2003'.trim() === 'Roma tomatoes'`). Em-space / NBSP
 * padding therefore invented clean draft lines and could invent a clean
 * header skip (`'^order draft for'.test('\u2003Order draft…\u2003'.trim())`).
 *
 * Presentation line labels follow the same ASCII C display-prep contract used
 * by Create Task title (#880 / MISE-005QT), restaurant-tasks title (#822 /
 * MISE-005ON), floor-notes title (#838 / MISE-005PD), and supplier
 * display-name prep (#410 / #691 / #692): fold NBSP to a plain space, collapse
 * C-locale `[[:space:]]`, then ASCII space trim. Unicode `String#trim` / `\s`
 * would collapse em-space and other non-C whitespace the hosted COLLATE "C"
 * path leaves alone, inventing a label the operator-facing order message did
 * not present as ordinary ASCII spaces. Accents and case are preserved.
 *
 * Complements open demo unit-price tip #703 / MISE-005KH
 * (`orderPresentationIdentity.ts` Kelvin haystack) without sharing that
 * module or rewriting `estimateLineCents` / `itemName.toLowerCase()` on main.
 * Intentionally does not tip generated-order-message Notes: strip (#847),
 * supplier operator_note (#840), or Inventory / Scan Item typed-search.
 *
 * Soft empty after prep stays `null` so the scanner keeps the prior
 * `.trim()` emptiness → skip-line behavior. Soft empty for Unicode-only
 * spaces (em-space alone) stays `null` so a blank line cannot invent a
 * one-character token. Unsafe controls also soft to `null` on this
 * presentation path. No new max-length bound is introduced; the prior
 * scanner did not truncate labels (message body stays UTF-8 byte-bounded by
 * `ORDER_MESSAGE_MAX_BYTES`).
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
/** Reject C0 controls and DEL for single-line draft labels (full [[:cntrl:]]). */
const UNSAFE_LINE_CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Canonical display text for one supplier-draft line label (raw line,
 * itemName, or quantityLabel). Folds NBSP, collapses C whitespace,
 * ASCII-space trims. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded label.
 */
export function canonicalOrderPresentationLineLabel(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasUnsafeLineControls(value: string) {
  return UNSAFE_LINE_CONTROL.test(value);
}

/**
 * Soft normalize for supplier-draft line scanning. Preserves soft empty →
 * `null` (prior `.trim()` emptiness → skip) while refusing to invent a clean
 * label via Unicode em-space trim / `\s` collapse. Does not throw; unsafe
 * controls soft to `null` so a bad line is skipped rather than crashing
 * presentation.
 */
export function normalizeOrderPresentationLineLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into a skip. Do not invent a one-character label token.
  if (!value.trim()) return null;
  if (hasUnsafeLineControls(value)) return null;
  const prepared = canonicalOrderPresentationLineLabel(value);
  if (!prepared) return null;
  return prepared;
}
