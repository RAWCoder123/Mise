/**
 * Delivery-history application note free-text helpers (MISE-005PC).
 *
 * Pins application-layer `mergeDeliveryHistoryEntries` presentation
 * `noteFromMetadata` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Receipt notes
 * previously Unicode-trimmed through `note.trim()`, so em-space padding
 * invented a clean free-text body before the history row returned it
 * (`'\u2003Morning drop\u2003'.trim() === 'Morning drop'`).
 *
 * Delivery-history notes are multiline operator free-text (parity with
 * supplier `operator_note` / open SQL cntrl pin #553/#672 / MISE-005OS
 * count-line note / MISE-005OT error / MISE-005OU lesson / MISE-005PA
 * delivery notes / MISE-005PB waste notes / MISE-005EP): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded note.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in receive notes.
 *
 * Complements open wasteAnalysis note tip #836 / MISE-005PB and
 * supplierReliability delivery-notes tip #835 / MISE-005PA without sharing
 * their helper modules or rewriting those paths. Intentionally does not change
 * inventory event identity fields, outbox freeze-raw clientEventId /
 * idempotencyKey emptiness-only contracts, or receiving validation bounds
 * beyond soft presentation.
 *
 * Soft empty after prep stays `null` so a receipt without a note stays
 * ordinary. Soft presentation does not newly truncate: the prior merge path
 * returned the full trimmed string with no `.slice`. Evidence / merge uses soft
 * canonicalize only so it does not newly throw on presentation text that
 * previously passed through `.trim()`. Distinct from open SQL cntrl pins
 * #553 / #672. Fail-closed normalize may refuse over-long (>500) tokens to
 * match `miseValidation` `optionalBoundedText(..., 500)` for inbound notes.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const DELIVERY_HISTORY_NOTE_MAX_CHARACTERS = 500;

/**
 * Canonical free-text for delivery-history notes on merge presentation.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded note
 * and internal newlines stay intact.
 */
export function canonicalDeliveryHistoryNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for `noteFromMetadata` / `mergeDeliveryHistoryEntries`.
 * Preserves soft empty → `null` (prior `note.trim() ? note.trim() : null`
 * contract) while refusing to invent a clean note via Unicode em-space trim.
 * Does not throw and does not newly truncate.
 */
export function canonicalizeDeliveryHistoryNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character delivery-history note.
  if (!value.trim()) return null;
  const canonical = canonicalDeliveryHistoryNote(value);
  return canonical || null;
}

/**
 * Fail-closed delivery-history-note normalize for callers that need a thrown
 * contract. Soft empty → `null`. Unsafe-control / over-long / non-string
 * tokens fail with distinct messages. Merge presentation does not use this
 * path so it retains the prior never-throw contract.
 *
 * Error contracts:
 * - non-string / unsafe control → `Delivery history note must be text.`
 * - over-long (>500) → `Delivery history note is outside supported limits.`
 */
export function normalizeCanonicalDeliveryHistoryNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Delivery history note must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Delivery history note must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character delivery-history note.
  if (!value.trim()) return null;
  const prepared = canonicalDeliveryHistoryNote(value);
  if (!prepared) return null;
  if (prepared.length > DELIVERY_HISTORY_NOTE_MAX_CHARACTERS) {
    throw new Error("Delivery history note is outside supported limits.");
  }
  return prepared;
}

/**
 * Fail-closed delivery-history-note require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Delivery history note must be text.`
 */
export function requireCanonicalDeliveryHistoryNote(value: unknown): string {
  const canonical = normalizeCanonicalDeliveryHistoryNote(value);
  if (!canonical) {
    throw new Error("Delivery history note must be text.");
  }
  return canonical;
}
