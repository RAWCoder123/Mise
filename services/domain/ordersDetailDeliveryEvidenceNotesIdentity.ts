/**
 * Orders detail delivery-evidence `notes` display helpers (MISE-005AAW).
 *
 * Pins the Orders detail delivery-verification note branch that previously
 * selected display text with raw truthiness:
 * `evidence.notes ? <Text>{evidence.notes}</Text> : null`.
 *
 * A Unicode-only-space note (`"\u2003"`) is raw-truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the intentional
 * hide branch was bypassed and delivery evidence chrome could render a
 * blank-looking note body. Separately, Unicode `.trim()` on padded notes
 * (`"\u2003Late truck; crushed corner\u2003".trim() === "Late truck; crushed corner"`)
 * would invent a clean display body if that gate Unicode-trimmed before
 * interpolation. Control-bearing notes that survive upstream soft paths can
 * also reach the same always-pass Text.
 *
 * Delivery evidence notes are multiline free-text (parity with open domain tip
 * #835 / MISE-005PA builder canonicalize, operator_note / open SQL cntrl pin
 * #672, and Orders detail note.none #1013 / MISE-005VE): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded note.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in receive notes.
 *
 * These are presentation **Orders detail deliveryEvidence notes** display
 * tokens only — not the domain builder canonicalize owned by #835, not Orders
 * detail sent-note `orders.detail.note.none` (#1013), not delivery-evidence
 * timezone (#1010), not supplier_deliveries.notes SQL cntrl (#672), and not
 * task completion evidence tips (#883 / #1027). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live truthiness hide branch owns
 * the intentional empty state. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #835 / #1013 / #1010 / #670 on the Orders detail surface
 * without sharing those modules or rewriting their call sites. Alone-OK:
 * #835 may still pass em-padded notes through soft canonicalize; this tip
 * soft-nulls that padding at the UI gate instead of inventing a clean body.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * ASCII C multiline free-text prep for Orders detail deliveryEvidence notes.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent a clean note body and internal
 * newlines stay intact.
 */
export function asciiPrepOrdersDetailDeliveryEvidenceNotes(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Canonicalize a deliveryEvidence notes display token under ASCII C multiline
 * prep. Returns null when empty after prep, still Unicode-padded, or containing
 * disallowed controls.
 */
export function canonicalizeOrdersDetailDeliveryEvidenceNotes(
  value: string
): string | null {
  const prepared = asciiPrepOrdersDetailDeliveryEvidenceNotes(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  if (prepared !== prepared.trim()) return null;
  if (hasUnsafeMultilineControls(prepared)) return null;
  return prepared;
}

/**
 * Soft normalize one Orders detail deliveryEvidence notes display candidate.
 * Preserves soft empty → null (intentional hide branch) while refusing to
 * invent a clean note body via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * truthiness gate owns the empty state without inventing a clean delivery
 * note identity from padding, and without letting raw truthy Unicode-only
 * space bypass that hide.
 */
export function normalizeOrdersDetailDeliveryEvidenceNotes(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional hide branch.
  if (!value.trim()) return null;
  return canonicalizeOrdersDetailDeliveryEvidenceNotes(value);
}
