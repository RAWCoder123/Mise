/**
 * Inventory-operation note free-text helpers (MISE-005PT).
 *
 * Pins miseValidation `requireInventoryOperation` note prep (and the inventory
 * detail UI path that feeds it) outside the repository graph so Node tests can
 * exercise inventing proofs without loading Supabase or AsyncStorage. Operator
 * inventory notes previously Unicode-trimmed (`.trim()` only via
 * `optionalBoundedText` inside `requireInventoryOperation`, and
 * `noteText.trim()` in the inventory detail screen), so NBSP/em-space padding
 * invented a clean free-text body before the note was stored in ledger
 * metadata (`'\u2003Chilled on arrival\u2003'.trim() === 'Chilled on arrival'`).
 *
 * Inventory-operation notes are multiline operator free-text (parity with
 * open MISE-005PF supplier operator_note / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005OO restaurant-tasks detail /
 * MISE-005OP completionResult / MISE-005OW evidence summary /
 * MISE-005OX recommendedAction / MISE-005PA delivery notes /
 * MISE-005PB waste notes / MISE-005PC deliveryHistory notes /
 * MISE-005PE floor-notes body / MISE-005PQ operational profile notes): fold
 * NBSP to a plain space, then trim only C-locale `[[:space:]]` from the ends.
 * Do not collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality with
 * an unpadded note. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in inventory notes.
 *
 * Complements open inventory count-line / count-session note tips (#827 /
 * #845 / #846) and supplier operator_note (#840) without sharing those
 * modules or rewriting sibling `optionalBoundedText` paths for
 * `sourceReference` / `reasonCode` that still Unicode-trim on main. Those
 * remain on their existing contracts in this tip.
 *
 * Max length stays 500 to match the prior `optionalBoundedText(..., 500)`
 * bound used by `requireInventoryOperation`. Soft empty after prep stays
 * `null` so an operation without a note stays ordinary. Live require
 * preserves the prior messages (`Enter a valid note.` /
 * `Enter a shorter note.`).
 */

import { INVENTORY_OPERATION_NOTE_MAX_CHARACTERS } from "./securityLimits";

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for inventory-operation notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded note and
 * internal newlines stay intact.
 */
export function canonicalInventoryOperationNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for inventory detail UI submit prep. Preserves soft
 * empty → `null` (prior `noteText.trim() || undefined` emptiness) while
 * refusing to invent a clean note via Unicode em-space trim. Does not throw;
 * does not soft-truncate (fail-closed require owns the 500 bound for the live
 * application path).
 */
export function canonicalizeInventoryOperationNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character inventory note.
  if (!value.trim()) return null;
  const canonical = canonicalInventoryOperationNote(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Fail-closed inventory-operation note normalize for
 * `requireInventoryOperation` and inventing proofs. Soft empty → `null`.
 * Unsafe-control / over-long / non-string tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control → `Enter a valid note.`
 * - over-long (>500 after prep) → `Enter a shorter note.`
 */
export function normalizeCanonicalInventoryOperationNote(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Enter a valid note.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Enter a valid note.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character inventory note.
  if (!value.trim()) return null;
  const prepared = canonicalInventoryOperationNote(value);
  if (!prepared) return null;
  if (prepared.length > INVENTORY_OPERATION_NOTE_MAX_CHARACTERS) {
    throw new Error("Enter a shorter note.");
  }
  return prepared;
}

/**
 * Fail-closed inventory-operation note require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Enter a valid note.`
 */
export function requireCanonicalInventoryOperationNote(value: unknown): string {
  const canonical = normalizeCanonicalInventoryOperationNote(value);
  if (!canonical) {
    throw new Error("Enter a valid note.");
  }
  return canonical;
}
