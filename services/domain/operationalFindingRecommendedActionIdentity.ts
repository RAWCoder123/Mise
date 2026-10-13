/**
 * Operational finding-decision recommended-action free-text helpers (MISE-005OX).
 *
 * Pins domain-layer original `recommendedAction` and `editedRecommendedAction`
 * outside the repository graph so Node tests can exercise inventing proofs
 * without loading Supabase or demo storage. Finding recommended actions
 * previously Unicode-trimmed through shared `requireBoundedText` (`.trim()`
 * only) on decision input and hosted response hydrate, so NBSP/em-space
 * padding invented a clean free-text body before the durable recommended
 * action / edited recommended action stored it
 * (`'\u2003Order chicken before lunch service.\u2003'.trim() === 'Order chicken before lunch service.'`).
 *
 * Recommended actions are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail /
 * MISE-005OP completionResult / MISE-005OS count-line note / MISE-005OT error /
 * MISE-005OU lesson / MISE-005OV statement / MISE-005OW evidence summary /
 * MISE-005EP): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space padding
 * cannot invent equality with an unpadded recommended action. Accents and case
 * are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in recommended-action free-text.
 *
 * Complements open finding-decision evidence summary tip #831 / MISE-005OW,
 * evidence identity tip #792 / MISE-005NJ, evidence type tip #793 / MISE-005NK,
 * object identities tip #790 / MISE-005NH, restaurant workspace tip #791 /
 * MISE-005NI, and response enum / id tips #794–#799 without sharing their
 * helper modules or rewriting those paths. Intentionally does not change other
 * `requireBoundedText` surfaces (`restaurantId`, evidence `type` / `id` /
 * `summary`, clientEventId, idempotencyKey, decision/response identities, or
 * actor). Those remain on their existing Unicode-trim contracts in this tip.
 *
 * Max length stays 320 to match the prior
 * `requireBoundedText(..., "Finding recommended action" | "Edited recommended action", 320)`
 * caps. Empty-after-prep remains hard-required with the prior label-specific
 * invalid messages so a blank recommended action cannot soft-null into durable
 * decision text. Distinct from open SQL cntrl pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for finding recommended actions on decision input /
 * hydrate. Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded recommended action and internal newlines stay intact.
 */
export function canonicalOperationalFindingRecommendedAction(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

function requireCanonicalRecommendedActionFreeText(
  value: unknown,
  invalidMessage: string
): string {
  if (typeof value !== "string") {
    throw new Error(invalidMessage);
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error(invalidMessage);
  }
  const canonical = canonicalOperationalFindingRecommendedAction(value);
  if (!canonical) {
    throw new Error(invalidMessage);
  }
  // Unicode-only spaces (for example em-space alone): prior requireBoundedText
  // treated empty-after-Unicode-trim as invalid. Do not invent a one-character
  // recommended action.
  if (!value.trim()) {
    throw new Error(invalidMessage);
  }
  if (canonical.length > 320) {
    throw new Error(invalidMessage);
  }
  return canonical;
}

/**
 * Fail-closed original recommended-action require for decision input + hydrate.
 * Preserves the existing `Finding recommended action is invalid.` error
 * contract from `requireBoundedText` while refusing to invent a clean action
 * via Unicode em-space trim. Empty-after-prep (including Unicode-only spaces)
 * stays invalid for this required field. Over-long tokens still fail closed at
 * 320 (prior `normalized.length > max` gate).
 */
export function requireCanonicalOperationalFindingRecommendedAction(
  value: unknown
): string {
  return requireCanonicalRecommendedActionFreeText(
    value,
    "Finding recommended action is invalid."
  );
}

/**
 * Fail-closed edited recommended-action require for decision input + hydrate.
 * Preserves the existing `Edited recommended action is invalid.` error
 * contract from `requireBoundedText` while refusing to invent a clean edit via
 * Unicode em-space trim. Callers still treat null/undefined as absent before
 * invoking this helper. Empty-after-prep stays invalid when an edit string is
 * provided. Over-long tokens still fail closed at 320.
 */
export function requireCanonicalOperationalFindingEditedRecommendedAction(
  value: unknown
): string {
  return requireCanonicalRecommendedActionFreeText(
    value,
    "Edited recommended action is invalid."
  );
}
