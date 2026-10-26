/**
 * Inventory count-sheet UI line-note free-text helpers (MISE-005QY).
 *
 * Pins `app/inventory/count.tsx` `buildCountLinePayload()` variance-note prep
 * outside the React Native screen graph so Node tests can exercise inventing
 * proofs without loading Expo. The prior path Unicode-trimmed the operator
 * note before the over-long gate and the `saveInventoryCountLines` /
 * `submitInventoryCountSession` line `note` payload
 * (`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`), so NBSP /
 * em-space padding invented equality with a clean free-text variance note
 * before count-line save/submit stored it.
 *
 * Count-sheet notes are multiline operator free-text (parity with open
 * MISE-005QW shared-task completion evidence note / MISE-005QX Daily Brief
 * recommended-action edit / MISE-005OS domain count-line note /
 * MISE-005PL miseValidation count-line note / MISE-005PT inventory-operation
 * note): fold NBSP to a plain space, then trim only C-locale `[[:space:]]`
 * from the ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded variance note. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks an operator may paste into a variance note.
 *
 * Soft empty after prep stays `null` so the count sheet keeps the prior
 * `.trim()` emptiness → omit optional note. Unsafe-control tokens also soft
 * to `null` on this interactive path so a bad paste cannot crash save /
 * submit. Over-long stays a caller-owned throw after ASCII C prep (prior
 * 240-character `inventory.count.noteTooLong` contract); this helper does not
 * invent length via Unicode trim.
 *
 * Complements open domain count-line note tip (#827 / MISE-005OS) and
 * miseValidation count-line note tip (#846 / MISE-005PL) without sharing those
 * modules or rewriting domain merge/plan / validation Unicode-trim contracts
 * on this path. Intentionally leaves `draftCounts` quantity `.trim()`,
 * presentation `noteRaw.trim()` show-note gates, count-session opening note
 * (#845), and inventory-operation / Log Delivery notes (#854) alone.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for inventory count-sheet variance notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded variance note and
 * internal newlines stay intact.
 */
export function canonicalInventoryCountSheetNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for inventory count-sheet variance notes. Preserves soft
 * empty → `null` (prior `.trim()` emptiness → omit optional note) while
 * refusing to invent a clean note via Unicode em-space trim. Does not throw;
 * unsafe controls soft to `null` so the count form stays available. Callers
 * enforce the existing 240-character over-long throw against the prepared
 * string rather than a Unicode-trimmed inventing length.
 */
export function normalizeInventoryCountSheetNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the omit-optional-note path. Do not invent a
  // one-character variance note token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalInventoryCountSheetNote(value);
  if (!prepared) return null;
  return prepared;
}
