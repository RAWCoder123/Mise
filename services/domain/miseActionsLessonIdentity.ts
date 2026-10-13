/**
 * Mise-actions domain lesson free-text helpers (MISE-005OU).
 *
 * Pins domain-layer `measureOutcome` `lesson` outside the repository graph so
 * Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Outcome lessons previously Unicode-trimmed (`.trim()` only), so
 * NBSP/em-space padding invented a clean free-text body before the durable
 * outcome lesson field stored it
 * (`'\u2003Ordering before cutoff\u2003'.trim() === 'Ordering before cutoff'`).
 *
 * Outcome lessons are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005OS count-line note / MISE-005OT error /
 * MISE-005EP): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded lesson. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in measured-outcome lessons.
 *
 * Complements open mise-actions approvedBy tip #800 / MISE-005NR,
 * rollbackReference tip #801 / MISE-005NS, subject/idempotency/action tip
 * #772 / MISE-005MP, and error tip #828 / MISE-005OT without sharing their
 * helper modules or rewriting those paths. Intentionally does not change
 * `markFailed` `error` free-text, hydrate `error_message` pass-through,
 * `requestedBy` pass-through, `restaurantId` / `actionId` Unicode trim on
 * `measureOutcome`, or restaurantMemory lesson consumers. Those remain on
 * their existing Unicode-trim / pass-through contracts in this tip.
 *
 * Max length stays 1000 to match the hosted `action_outcomes.lesson` /
 * append-only writer bound (`nullif(left(trim(new.lesson), 1000), '')`).
 * Empty-after-prep (including Unicode-only spaces) preserves the prior soft
 * null (`input.lesson?.trim() || null`) so a blank lesson stays ordinary.
 * Distinct from open SQL cntrl pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for mise-actions lesson on measureOutcome. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded lesson and
 * internal newlines stay intact.
 */
export function canonicalMiseActionsLesson(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed lesson normalize for measureOutcome. Preserves soft empty → null
 * while refusing unsafe-control / over-long / non-string tokens, and refusing
 * to invent a clean lesson via Unicode em-space trim. Null/undefined/"" remain
 * null (optional lesson).
 *
 * Error contracts:
 * - non-string / unsafe control → `Mise action lesson must be text.`
 * - over-long (>1000) → `Mise action lesson is outside supported limits.`
 */
export function normalizeCanonicalMiseActionsLesson(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Mise action lesson must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Mise action lesson must be text.");
  }
  const canonical = canonicalMiseActionsLesson(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): prior
  // `.trim() || null` treated that as null; do not invent a one-character
  // lesson.
  if (!value.trim()) return null;
  if (canonical.length > 1000) {
    throw new Error("Mise action lesson is outside supported limits.");
  }
  return canonical;
}
