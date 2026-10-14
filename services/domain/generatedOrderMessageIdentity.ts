/**
 * Order-message Notes-suffix free-text helpers (MISE-005PM).
 *
 * Pins the orders UI `generatedOrderMessage` display strip (and the matching
 * `buildSupplierOrderMessage` Notes: append path) outside the repository graph
 * so Node tests can exercise inventing proofs without loading React Native or
 * Supabase. Both call sites previously Unicode-trimmed the operator note
 * (`.trim()` only) before building or stripping the `\n\nNotes:\n` suffix, so
 * NBSP/em-space padding invented a clean free-text body
 * (`'\u2003Call on arrival\u2003'.trim() === 'Call on arrival'`). That invented
 * clean note then failed to match a message that still carried the raw padded
 * suffix, or silently rewrote identity when the builder and display disagreed.
 *
 * Notes suffixes are multiline operator free-text (parity with open supplier
 * `operator_note` tip #840 / MISE-005PF, count-line note tips #827 / #846,
 * floor-notes body #839, and related free-text tips): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded note.
 * Accents and case are preserved.
 *
 * Soft empty after prep stays `null` so a draft without a note stays ordinary
 * and the display strip is a no-op. Soft canonicalize never throws; live
 * `requireSupplierOperatorNote` remains the fail-closed gate for writes and is
 * intentionally left on its existing contract in this tip (#840 owns that
 * path). Intentionally does not change inventory count-line / session notes,
 * floor-notes, waste/deliveryHistory notes, restaurant-memory statement, or
 * user profile display-name trim.
 */

import type { SupplierOrder } from "../../types/mise";

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;

/**
 * Canonical free-text for order-message Notes suffixes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded note and
 * internal newlines stay intact.
 */
export function canonicalOrderMessageNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

/**
 * Soft canonicalize for `generatedOrderMessage` display strip and
 * `buildSupplierOrderMessage` Notes: append. Preserves soft empty → `null`
 * (prior Unicode-trim emptiness contract) while refusing to invent a clean
 * note via Unicode em-space trim. Does not throw.
 */
export function canonicalizeOrderMessageNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior Unicode trim
  // emptied those. Do not invent a one-character Notes suffix.
  if (!value.trim()) return null;
  const canonical = canonicalOrderMessageNote(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Display helper: strip the trailing `\n\nNotes:\n…` suffix from a supplier
 * order message when it matches the order's operator note under ASCII C prep.
 * Returns the raw `order_message` when there is no note or the suffix does not
 * match (never invents a clean note via Unicode trim to force a match).
 */
export function generatedOrderMessage(
  order: Pick<SupplierOrder, "order_message" | "operator_note">
): string {
  const note = canonicalizeOrderMessageNote(order.operator_note);
  if (!note) return order.order_message;
  const suffix = "\n\nNotes:\n" + note;
  return order.order_message.endsWith(suffix)
    ? order.order_message.slice(0, -suffix.length)
    : order.order_message;
}
