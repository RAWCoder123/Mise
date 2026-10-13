/**
 * Operational finding-decision evidence summary free-text helpers (MISE-005OW).
 *
 * Pins domain-layer `normalizeEvidence` `summary` outside the repository graph
 * so Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Finding evidence summaries previously Unicode-trimmed through shared
 * `requireBoundedText` (`.trim()` only) on decision input and hosted response
 * hydrate, so NBSP/em-space padding invented a clean free-text body before the
 * durable evidence summary stored it
 * (`'\u2003Chicken has less than one service day of coverage.\u2003'.trim() === 'Chicken has less than one service day of coverage.'`).
 *
 * Evidence summaries are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005OS count-line note / MISE-005OT error /
 * MISE-005OU lesson / MISE-005OV statement / MISE-005EP): fold NBSP to a plain
 * space, then trim only C-locale `[[:space:]]` from the ends. Do not collapse
 * internal whitespace with `\s` or Unicode `String#trim`, so internal LF/TAB/CR
 * survive and em-space padding cannot invent equality with an unpadded summary.
 * Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in evidence summaries.
 *
 * Complements open finding-decision evidence identity tip #792 / MISE-005NJ,
 * evidence type tip #793 / MISE-005NK, object identities tip #790 / MISE-005NH,
 * restaurant workspace tip #791 / MISE-005NI, and response enum / id tips
 * #794–#799 without sharing their helper modules or rewriting those paths.
 * Intentionally does not change other `requireBoundedText` surfaces
 * (`restaurantId`, evidence `type` / `id`, recommended action, edited
 * recommended action, clientEventId, idempotencyKey, decision/response
 * identities, or actor). Those remain on their existing Unicode-trim contracts
 * in this tip.
 *
 * Max length stays 240 to match the prior
 * `requireBoundedText(..., "Finding evidence summary", 240)` cap. Empty-after-prep
 * remains hard-required (`Finding evidence summary is invalid.`) so a blank
 * summary cannot soft-null into durable evidence. Distinct from open SQL cntrl
 * pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for finding evidence summary on decision input / hydrate.
 * Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse
 * with `\s`, so em-space padding cannot invent equality with an unpadded
 * summary and internal newlines stay intact.
 */
export function canonicalOperationalFindingEvidenceSummary(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed summary require for normalizeEvidence (decision input + hydrate).
 * Preserves the existing `Finding evidence summary is invalid.` error contract
 * from `requireBoundedText` while refusing to invent a clean summary via
 * Unicode em-space trim. Empty-after-prep (including Unicode-only spaces) stays
 * invalid for this required field. Over-long tokens still fail closed at 240
 * (prior `normalized.length > max` gate).
 */
export function requireCanonicalOperationalFindingEvidenceSummary(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Finding evidence summary is invalid.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Finding evidence summary is invalid.");
  }
  const canonical = canonicalOperationalFindingEvidenceSummary(value);
  if (!canonical) {
    throw new Error("Finding evidence summary is invalid.");
  }
  // Unicode-only spaces (for example em-space alone): prior requireBoundedText
  // treated empty-after-Unicode-trim as invalid. Do not invent a one-character
  // summary.
  if (!value.trim()) {
    throw new Error("Finding evidence summary is invalid.");
  }
  if (canonical.length > 240) {
    throw new Error("Finding evidence summary is invalid.");
  }
  return canonical;
}
