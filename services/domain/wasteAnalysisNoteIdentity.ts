/**
 * Waste-analysis domain note free-text helpers (MISE-005PB).
 *
 * Pins domain-layer `buildWasteAnalysis` presentation `noteFromMetadata` outside
 * the repository graph so Node tests can exercise inventing proofs without
 * loading Supabase or demo storage. Waste-event notes previously
 * Unicode-trimmed through `note.trim().slice(0, 500)`, so em-space padding
 * invented a clean free-text body before the recent-events row returned it
 * (`'\u2003Spill during prep\u2003'.trim() === 'Spill during prep'`).
 *
 * Waste notes are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #553/#672 / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005PA delivery notes /
 * MISE-005EP): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded note. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in waste notes.
 *
 * Complements open supplierReliability delivery-notes tip #835 / MISE-005PA
 * and inventory count-line note tip #827 / MISE-005OS without sharing their
 * helper modules or rewriting those paths. Intentionally does not change
 * `input.restaurantId.trim()` or `requireTimeZone` emptiness-only
 * (`!value.trim()` then Intl on the raw token). Those remain on their
 * existing contracts in this tip (`restaurantId` has its own open tip stack;
 * timezone Intl-raw emptiness stays fail-closed).
 *
 * Soft presentation keeps the prior 500-character truncate after prep so
 * recent-event rows stay bounded. Soft empty after prep stays `null` so a
 * waste event without a note stays ordinary. Evidence build uses soft
 * canonicalize only so it does not newly throw on presentation text that
 * previously passed through `.trim().slice(0, 500)`. Distinct from open SQL
 * cntrl pins #553 / #672.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const WASTE_ANALYSIS_NOTE_MAX_CHARACTERS = 500;

/**
 * Canonical free-text for waste-analysis notes on recent-event presentation.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded note
 * and internal newlines stay intact.
 */
export function canonicalWasteAnalysisNote(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for `noteFromMetadata` / `buildWasteAnalysis` recent
 * events. Preserves soft empty → `null` (prior `note.trim() ? … : null`
 * contract) and the prior 500-character soft truncate while refusing to invent
 * a clean note via Unicode em-space trim. Does not throw.
 */
export function canonicalizeWasteAnalysisNote(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character waste note.
  if (!value.trim()) return null;
  const canonical = canonicalWasteAnalysisNote(value);
  if (!canonical) return null;
  return canonical.slice(0, WASTE_ANALYSIS_NOTE_MAX_CHARACTERS);
}

/**
 * Fail-closed waste-note normalize for callers that need a thrown contract.
 * Soft empty → `null`. Unsafe-control / over-long / non-string tokens fail
 * with distinct messages. Evidence build does not use this path so it retains
 * the prior never-throw presentation contract (including soft truncate).
 *
 * Error contracts:
 * - non-string / unsafe control → `Waste analysis note must be text.`
 * - over-long (>500) → `Waste analysis note is outside supported limits.`
 */
export function normalizeCanonicalWasteAnalysisNote(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Waste analysis note must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Waste analysis note must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character waste note.
  if (!value.trim()) return null;
  const prepared = canonicalWasteAnalysisNote(value);
  if (!prepared) return null;
  // Soft presentation truncates; fail-closed callers refuse over-long after C
  // prep so they cannot silently accept >500.
  if (prepared.length > WASTE_ANALYSIS_NOTE_MAX_CHARACTERS) {
    throw new Error("Waste analysis note is outside supported limits.");
  }
  return prepared;
}

/**
 * Fail-closed waste-note require for focused inventing proofs. Preserves a
 * distinct message from sibling tips:
 * `Waste analysis note must be text.`
 */
export function requireCanonicalWasteAnalysisNote(value: unknown): string {
  const canonical = normalizeCanonicalWasteAnalysisNote(value);
  if (!canonical) {
    throw new Error("Waste analysis note must be text.");
  }
  return canonical;
}
