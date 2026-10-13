/**
 * Inventory count-line note free-text helpers for miseValidation (MISE-005PL).
 *
 * Pins miseValidation `requireInventoryCountLineNote` (and the application
 * `saveInventoryCountLines` path that feeds it via
 * `requireInventoryCountLineUpdates`) outside the repository graph so Node
 * tests can exercise inventing proofs without loading Supabase or
 * AsyncStorage. Count-line notes previously Unicode-trimmed (`.trim()` only),
 * so NBSP/em-space padding invented a clean free-text body before save-line
 * writes stored it
 * (`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`).
 *
 * Count-line notes are multiline operator free-text (parity with open domain
 * count-line note tip #827 / MISE-005OS, count-session opening note tip #845 /
 * MISE-005PK, supplier `operator_note` #840 / MISE-005PF, and open SQL cntrl
 * pin #552 / MISE-005EN): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded note. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in variance notes. Complements open domain tip
 * #827 / MISE-005OS without rewriting domain `mergeCountLineUpdates` /
 * `planCountSessionApprovals` Unicode-trim contracts in this tip, and leaves
 * sibling miseValidation `requireInventoryCountSessionNote`,
 * `generatedOrderMessage` display trim, and inventoryItemId Map-key trim on
 * their existing contracts.
 *
 * Max length stays 240 to match the prior require cap and the hosted
 * `inventory_count_lines.note` bound. Soft empty after prep stays `null` so a
 * line without a note stays ordinary. Live require preserves the prior
 * over-long message (`Count line note is limited to 240 characters.`).
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for inventory count-line notes. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded note and
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
 * Soft canonicalize for callers that previously used `.trim() || null`.
 * Preserves soft empty → `null` while refusing to invent a clean note via
 * Unicode em-space trim. Does not throw; does not soft-truncate (fail-closed
 * require owns the 240 bound for the live application path).
 */
export function canonicalizeInventoryCountLineNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character line note.
  if (!value.trim()) return null;
  const canonical = canonicalInventoryCountLineNote(value);
  if (!canonical) return null;
  return canonical;
}

/**
 * Fail-closed count-line note normalize for
 * `requireInventoryCountLineNote`, domain merge/plan callers, and inventing
 * proofs. Soft empty → `null`. Unsafe-control / over-long / non-string tokens
 * fail with distinct messages.
 *
 * Error contracts:
 * - non-string / unsafe control → `Count line note must be text.`
 * - over-long (>240 after prep) → caller-selected message (require default
 *   `Count line note is limited to 240 characters.`; plan may use
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
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character line note.
  if (!value.trim()) return null;
  const prepared = canonicalInventoryCountLineNote(value);
  if (!prepared) return null;
  if (prepared.length > 240) {
    throw new Error(
      options?.overLongMessage ?? "Count line note is limited to 240 characters."
    );
  }
  return prepared;
}

/**
 * Fail-closed count-line note require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Count line note must be text.`
 */
export function requireCanonicalInventoryCountLineNote(value: unknown): string {
  const canonical = normalizeCanonicalInventoryCountLineNote(value);
  if (!canonical) {
    throw new Error("Count line note must be text.");
  }
  return canonical;
}
