/**
 * Operational profile notes free-text helpers (MISE-005PQ).
 *
 * Pins miseValidation operational-profile `notes` prep outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or AsyncStorage. Profile notes previously Unicode-trimmed (`.trim()` only
 * via `requireNullableBoundedText`), so NBSP/em-space padding invented a clean
 * free-text body before `update_restaurant_profile` stored it
 * (`'\u2003Count before ordering\u2003'.trim() === 'Count before ordering'`).
 *
 * Operational profile notes are multiline operator free-text (parity with
 * MISE-005PF supplier operator_note / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005OO restaurant-tasks detail /
 * MISE-005OP completionResult / MISE-005OW evidence summary /
 * MISE-005OX recommendedAction / MISE-005PA delivery notes /
 * MISE-005PB waste notes / MISE-005PC deliveryHistory notes /
 * MISE-005PE floor-notes body / MISE-005PN restaurant-memory correction draft):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded note. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in profile notes.
 *
 * Complements open restaurant address inventing tip (#850 / MISE-005PP) and
 * the shared `requireNullableBoundedText` helper without rewriting that helper
 * (still used by logo URL, and by address until #850 lands), sibling
 * restaurant-name inventing (#844 / MISE-005PJ), cuisine inventing
 * (#842 / MISE-005PH), or `requireBoundedStringArray` entry trim for
 * orderCadence / prepWindows / primarySuppliers / inventoryReviewDays. Those
 * remain on their existing contracts in this tip. Hydrate
 * `asNullableString(profile.notes)` stays pass-through.
 *
 * Max length stays 2000 to match `RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS` and
 * the hosted `private.restaurant_operational_profile_is_valid` notes bound.
 * Soft empty after prep stays `null` so a profile without notes stays
 * ordinary. Live require preserves the prior messages
 * (`Operational profile notes must be text or empty.` /
 * `Operational profile notes is limited to 2000 characters.`).
 */

import { RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS } from "./securityLimits";

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for operational profile notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded note and
 * internal newlines stay intact.
 */
export function canonicalOperationalProfileNotes(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for emptiness checks. Preserves soft empty → `null`
 * (prior `.trim() || null` contract) while refusing to invent a clean note via
 * Unicode em-space trim. Does not throw; does not soft-truncate (fail-closed
 * require owns the 2000 bound for the live application path).
 */
export function canonicalizeOperationalProfileNotes(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character operational profile note.
  if (!value.trim()) return null;
  const canonical = canonicalOperationalProfileNotes(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Fail-closed operational profile notes normalize for
 * `requireOperationalProfileNotes` and inventing proofs. Soft empty → `null`.
 * Unsafe-control / over-long / non-string tokens fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control → `Operational profile notes must be text or empty.`
 * - over-long (>2000 after prep) → `Operational profile notes is limited to 2000 characters.`
 */
export function normalizeCanonicalOperationalProfileNotes(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Operational profile notes must be text or empty.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Operational profile notes must be text or empty.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character operational profile note.
  if (!value.trim()) return null;
  const prepared = canonicalOperationalProfileNotes(value);
  if (!prepared) return null;
  if (prepared.length > RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS) {
    throw new Error(
      `Operational profile notes is limited to ${RESTAURANT_PROFILE_NOTES_MAX_CHARACTERS} characters.`
    );
  }
  return prepared;
}

/**
 * Fail-closed operational profile notes require for focused inventing proofs
 * where a present note must already be canonical. Soft empty fails closed
 * rather than inventing text.
 */
export function requireCanonicalOperationalProfileNotes(value: unknown): string {
  const canonical = normalizeCanonicalOperationalProfileNotes(value);
  if (!canonical) {
    throw new Error("Operational profile notes must be text or empty.");
  }
  return canonical;
}
