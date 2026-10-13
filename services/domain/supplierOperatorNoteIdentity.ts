/**
 * Supplier-order operator_note free-text helpers (MISE-005PF).
 *
 * Pins miseValidation `requireSupplierOperatorNote` (and the orders UI / demo
 * patch paths that feed it) outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or AsyncStorage. Supplier
 * operator notes previously Unicode-trimmed (`.trim()` only), so NBSP/em-space
 * padding invented a clean free-text body before draft orders stored it
 * (`'\u2003Call on arrival\u2003'.trim() === 'Call on arrival'`).
 *
 * Operator notes are multiline operator free-text (parity with open SQL cntrl
 * pin #551 / MISE-005OS count-line note / MISE-005OT error / MISE-005OU lesson /
 * MISE-005OO restaurant-tasks detail / MISE-005OP completionResult /
 * MISE-005OW evidence summary / MISE-005OX recommendedAction /
 * MISE-005PA delivery notes / MISE-005PB waste notes /
 * MISE-005PC deliveryHistory notes / MISE-005PE floor-notes body / MISE-005EP):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded note. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in supplier notes.
 *
 * Complements open SQL cntrl pin #551 / MISE-005EM without sharing its
 * migration or rewriting sibling free-text tips. Intentionally does not change
 * `requireInventoryCountLineNote`, `generatedOrderMessage` display trim,
 * delivery_date patch handling, or order_message builders beyond consuming the
 * already-canonicalized note. Those remain on their existing contracts in this
 * tip.
 *
 * Max length stays 2000 to match `SUPPLIER_NOTE_MAX_CHARACTERS` and the hosted
 * `supplier_orders.operator_note` bound. Soft empty after prep stays `null` so
 * a draft without a note stays ordinary. Live require preserves the prior
 * over-long message (`Supplier note is limited to 2,000 characters.`).
 */

import { SUPPLIER_NOTE_MAX_CHARACTERS } from "./securityLimits";

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for supplier operator notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded note and
 * internal newlines stay intact.
 */
export function canonicalSupplierOperatorNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for orders UI dirty checks and demo repository patch
 * application. Preserves soft empty → `null` (prior `.trim() || null`
 * contract) while refusing to invent a clean note via Unicode em-space trim.
 * Does not throw; does not soft-truncate (fail-closed require owns the 2000
 * bound for the live application path).
 */
export function canonicalizeSupplierOperatorNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character supplier note.
  if (!value.trim()) return null;
  const canonical = canonicalSupplierOperatorNote(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Fail-closed supplier operator-note normalize for
 * `requireSupplierOperatorNote` and inventing proofs. Soft empty → `null`.
 * Unsafe-control / over-long / non-string tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control → `Supplier note must be text.`
 * - over-long (>2000 after prep) → `Supplier note is limited to 2,000 characters.`
 */
export function normalizeCanonicalSupplierOperatorNote(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Supplier note must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Supplier note must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character supplier note.
  if (!value.trim()) return null;
  const prepared = canonicalSupplierOperatorNote(value);
  if (!prepared) return null;
  if (prepared.length > SUPPLIER_NOTE_MAX_CHARACTERS) {
    throw new Error(
      `Supplier note is limited to ${SUPPLIER_NOTE_MAX_CHARACTERS.toLocaleString()} characters.`
    );
  }
  return prepared;
}

/**
 * Fail-closed supplier operator-note require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Supplier note must be text.`
 */
export function requireCanonicalSupplierOperatorNote(value: unknown): string {
  const canonical = normalizeCanonicalSupplierOperatorNote(value);
  if (!canonical) {
    throw new Error("Supplier note must be text.");
  }
  return canonical;
}
