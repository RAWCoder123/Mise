/**
 * Inventory count-session domain line-note free-text helpers (MISE-005OS).
 *
 * Pins domain-layer `mergeCountLineUpdates` / `planCountSessionApprovals`
 * `note` outside the repository graph so Node tests can exercise inventing
 * proofs without loading Supabase or demo storage. Count-line notes previously
 * Unicode-trimmed (`.trim()` only), so NBSP/em-space padding invented a clean
 * note before save updates or approval ledger metadata stored it
 * (`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`).
 *
 * Count-line notes are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005EP): fold NBSP to a plain space, then
 * trim only C-locale `[[:space:]]` from the ends. Do not collapse internal
 * whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive
 * and em-space padding cannot invent equality with an unpadded note. Accents
 * and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in variance notes.
 *
 * Complements open count-session inventoryItemId tip #770 / MISE-005MN without
 * sharing its helper module or rewriting that Map-key path. Intentionally does
 * not change `inventoryItemId.trim()` on merge, miseValidation count-note
 * helpers, or delivery/waste note presentation helpers. Those remain on their
 * existing Unicode-trim contracts in this tip.
 *
 * Max length stays 240 to match the prior merge/plan caps and the hosted
 * count-line note bound. Empty-after-prep remains soft-null so a line without
 * a note stays ordinary and fully recordable. Distinct from open SQL cntrl
 * pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for inventory count-line notes on merge / plan. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded note and
 * internal newlines stay intact.
 */
export function canonicalInventoryCountLineNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed count-line note normalize for merge updates and approval
 * planning. Preserves soft empty → null while refusing unsafe-control /
 * over-long / non-string tokens, and refusing to invent a clean note via
 * Unicode em-space trim. Null/undefined/"" remain null (optional note).
 *
 * Error contracts:
 * - non-string / unsafe control → `Count line note must be text.`
 * - over-long → caller-selected message (merge default
 *   `Count line note is limited to 240 characters.`; plan uses
 *   `Count line note is outside supported limits.`)
 */
export function normalizeCanonicalInventoryCountLineNote(
  value: unknown,
  options?: { overLongMessage?: string }
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Count line note must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Count line note must be text.");
  }
  const canonical = canonicalInventoryCountLineNote(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): prior
  // `.trim()` treated that as null; do not invent a one-character note.
  if (!value.trim()) return null;
  if (canonical.length > 240) {
    throw new Error(
      options?.overLongMessage ?? "Count line note is limited to 240 characters."
    );
  }
  return canonical;
}
