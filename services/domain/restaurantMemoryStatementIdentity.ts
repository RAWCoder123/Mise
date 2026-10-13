/**
 * Restaurant-memory domain statement free-text helpers (MISE-005OV).
 *
 * Pins domain-layer `createMemory` / `correctMemory` / `createMemoryFromOutcome`
 * / hydrate `statement` outside the repository graph so Node tests can exercise
 * inventing proofs without loading Supabase or demo storage. Memory statements
 * previously Unicode-trimmed and collapsed through `boundedStatement`
 * (`.trim().replace(/\s+/g, " ")`) on create/correct, and Unicode-trimmed
 * through `options.statement?.trim() || outcome.lesson` /
 * `row.correction?.trim() || row.statement` on outcome-memory creation and
 * hydrate, so NBSP/em-space padding invented a clean free-text body before the
 * durable statement / correction-facing statement stored it
 * (`'\u2003Friday dinner demand is typically 18% higher.\u2003'.trim().replace(/\s+/g, " ") === 'Friday dinner demand is typically 18% higher.'`).
 * Mid-string Unicode spaces and internal LF/TAB/CR were likewise collapsed into
 * ordinary ASCII spaces on the required create/correct path, inventing equality
 * with an unpadded single-line statement.
 *
 * Restaurant-memory statements are multiline operator free-text (parity with
 * supplier `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005OS count-line note / MISE-005OT error /
 * MISE-005OU lesson / MISE-005EP): fold NBSP to a plain space, then trim only
 * C-locale `[[:space:]]` from the ends. Do not collapse internal whitespace
 * with `\s` or Unicode `String#trim`, so internal LF/TAB/CR survive and
 * em-space padding cannot invent equality with an unpadded statement. Accents
 * and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in outcome lessons and memory statements.
 *
 * Complements open mise-actions lesson tip #829 / MISE-005OU without sharing
 * its helper module or rewriting that path. Intentionally does not change
 * `requireRestaurantId` Unicode trim, `scope` / `source` Unicode trim on
 * create, learning-signal label/detail filters, or hydrate `correctionNote`
 * pass-through of the raw correction column. Those remain on their existing
 * Unicode-trim / pass-through contracts in this tip.
 *
 * Max length stays 320 to match the prior `boundedStatement` /
 * `normalized.slice(0, 320)` write cap. Create/correct empty-after-prep remains
 * hard-required (`Restaurant memory requires a non-empty statement.`) so a
 * blank statement cannot soft-null into a memory. Outcome-lesson / explicit
 * statement selection and hydrate correction preference stay soft-null so a
 * missing lesson/statement still fails closed at the outcome-memory gate and
 * incomplete corrections remain ordinary. Distinct from open SQL cntrl pin
 * #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for restaurant-memory statement create / correct /
 * outcome selection / hydrate. Folds NBSP, C-whitespace-trims ends only. Does
 * not Unicode-trim or collapse with `\s`, so em-space padding cannot invent
 * equality with an unpadded statement and internal newlines stay intact.
 */
export function canonicalRestaurantMemoryStatement(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed statement require for createMemory / correctMemory. Preserves
 * the existing `Restaurant memory requires a non-empty statement.` error
 * contract from `boundedStatement` while refusing to invent a clean statement
 * via Unicode em-space trim / `\s` collapse. Empty-after-prep (including
 * Unicode-only spaces) stays invalid for this required field. Over-long tokens
 * still truncate to 320 (prior `slice(0, 320)` write cap).
 */
export function requireCanonicalRestaurantMemoryStatement(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Restaurant memory requires a non-empty statement.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Restaurant memory statement is invalid.");
  }
  const canonical = canonicalRestaurantMemoryStatement(value);
  if (!canonical) {
    throw new Error("Restaurant memory requires a non-empty statement.");
  }
  // Unicode-only spaces (for example em-space alone): prior boundedStatement
  // treated empty-after-Unicode-trim as invalid. Do not invent a one-character
  // statement.
  if (!value.trim()) {
    throw new Error("Restaurant memory requires a non-empty statement.");
  }
  return canonical.slice(0, 320);
}

/**
 * Fail-closed statement normalize for createMemoryFromOutcome lesson /
 * statement selection and hydrate correction preference. Preserves soft empty
 * → null while refusing unsafe-control / non-string tokens, and refusing to
 * invent a clean statement via Unicode em-space trim. Null/undefined/"" remain
 * null (optional lesson/statement / absent correction). Does not truncate —
 * durable create/correct still apply the 320 write cap through
 * `requireCanonicalRestaurantMemoryStatement`. Error contract:
 * `Restaurant memory statement is invalid.`
 */
export function normalizeCanonicalRestaurantMemoryStatement(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Restaurant memory statement is invalid.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Restaurant memory statement is invalid.");
  }
  const canonical = canonicalRestaurantMemoryStatement(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): prior
  // `.trim()` emptiness checks treated that as absent; do not invent a
  // one-character statement.
  if (!value.trim()) return null;
  return canonical;
}
