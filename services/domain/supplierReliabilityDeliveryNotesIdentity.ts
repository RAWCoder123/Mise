/**
 * Supplier-reliability domain delivery-notes free-text helpers (MISE-005PA).
 *
 * Pins domain-layer `buildSupplierOrderDeliveryEvidence` presentation
 * `delivery.notes` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Delivery notes
 * previously Unicode-trimmed through `delivery.notes?.trim() || null`, so
 * em-space padding invented a clean free-text body before the evidence entry
 * returned it (`'\u2003Late truck; crushed corner\u2003'.trim() ===
 * 'Late truck; crushed corner'`).
 *
 * Delivery notes are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #553/#672 / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005EP): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded note.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in receive notes.
 *
 * Complements open supplier-reliability supplierName tip #834 / MISE-005OZ,
 * supplier_id tip #825 / MISE-005OQ, and restaurant tip #780 / MISE-005MX
 * without sharing their helper modules or rewriting those paths. Intentionally
 * does not change `discrepancy_reason?.trim()` emptiness-only gates,
 * `order.supplier_name.trim()`, `input.restaurantId.trim()`, or
 * `order.supplier_id.trim()`. Those remain on their existing contracts in this
 * tip (open #834 / #825 / #780 tip the identity fields separately; discrepancy
 * emptiness-only filters stay Unicode-trim-for-emptiness).
 *
 * Max length stays 2000 to match `supplier_deliveries_notes_bound_check`. Soft
 * empty after prep stays `null` so a delivery without notes stays ordinary.
 * Evidence build uses soft canonicalize only so it does not newly throw on
 * presentation text that previously passed through `.trim() || null`. Distinct
 * from open SQL cntrl pins #553 / #672.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const DELIVERY_NOTES_MAX_CHARACTERS = 2000;

/**
 * Canonical free-text for supplier-reliability delivery notes on evidence
 * build. Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded note and internal newlines stay intact.
 */
export function canonicalSupplierReliabilityDeliveryNotes(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for `buildSupplierOrderDeliveryEvidence`. Preserves soft
 * empty → `null` (prior `.trim() || null` contract) while refusing to invent a
 * clean note via Unicode em-space trim. Does not throw.
 */
export function canonicalizeSupplierReliabilityDeliveryNotes(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim() || null`
  // emptied those. Do not invent a one-character delivery note.
  if (!value.trim()) return null;
  const canonical = canonicalSupplierReliabilityDeliveryNotes(value);
  return canonical || null;
}

/**
 * Fail-closed delivery-notes normalize for callers that need a thrown
 * contract. Soft empty → `null`. Unsafe-control / over-long / non-string tokens
 * fail with distinct messages. Evidence build does not use this path so it
 * retains the prior never-throw presentation contract.
 *
 * Error contracts:
 * - non-string / unsafe control → `Supplier reliability delivery notes must be text.`
 * - over-long (>2000) → `Supplier reliability delivery notes are outside supported limits.`
 */
export function normalizeCanonicalSupplierReliabilityDeliveryNotes(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Supplier reliability delivery notes must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Supplier reliability delivery notes must be text.");
  }
  const canonical = canonicalizeSupplierReliabilityDeliveryNotes(value);
  if (!canonical) return null;
  if (canonical.length > DELIVERY_NOTES_MAX_CHARACTERS) {
    throw new Error("Supplier reliability delivery notes are outside supported limits.");
  }
  return canonical;
}

/**
 * Fail-closed delivery-notes require for focused inventing proofs. Preserves a
 * distinct message from sibling tips:
 * `Supplier reliability delivery notes must be text.`
 */
export function requireCanonicalSupplierReliabilityDeliveryNotes(value: unknown): string {
  const canonical = normalizeCanonicalSupplierReliabilityDeliveryNotes(value);
  if (!canonical) {
    throw new Error("Supplier reliability delivery notes must be text.");
  }
  return canonical;
}
