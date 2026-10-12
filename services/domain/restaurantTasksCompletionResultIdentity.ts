/**
 * Restaurant-tasks domain completionResult free-text helpers (MISE-005OP).
 *
 * Pins domain-layer `normalizeCompleteRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `completionResult` outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or demo storage. Completion results previously Unicode-trimmed and collapsed
 * through shared `requiredText` on complete (`.trim().replace(/\s+/g, " ")`)
 * and Unicode-trimmed through shared `optionalText` on hydrate (`.trim()`
 * only), so NBSP/em-space padding invented a clean free-text body before
 * complete RPC arguments or hydrated task rows stored it
 * (`'\u2003Counted 18 lb\u2003'.trim().replace(/\s+/g, " ") === 'Counted 18 lb'`).
 * Mid-string Unicode spaces and internal LF/TAB/CR were likewise collapsed
 * into ordinary ASCII spaces on the required complete path, inventing equality
 * with an unpadded single-line result.
 *
 * Completion result is multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005OO detail / MISE-005EP):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded result. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the
 * same line breaks operators need in completion evidence notes.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, createdBy tip #815 / MISE-005OG, completedBy tip
 * #816 / MISE-005OH, locationId tip #817 / MISE-005OI, sourceReference tip
 * #820 / MISE-005OL, relatedSupplierName tip #821 / MISE-005OM, title tip
 * #822 / MISE-005ON, detail tip #823 / MISE-005OO, restaurant tip #739 /
 * MISE-005LI, and application taskId tip #762 / MISE-005MF without sharing
 * their helper modules or rewriting those paths. Intentionally does not
 * change other `requiredText` / `optionalText` surfaces (`restaurantId`,
 * `clientTaskId`, `correlationId`, `dependencyIds`, `assigneeUserId`,
 * `title`, `createdBy`, `relatedInventoryItemId`, `relatedOrderId`,
 * `relatedRecommendationId`, `relatedSupplierName`, `sourceReference`,
 * `taskId` on complete, `completedBy`, `locationId`, or detail free-text).
 * Those remain on their existing Unicode-trim contracts in this tip.
 *
 * Max length stays 1000 to match the prior `requiredText` /
 * `optionalText(..., 1000, ...)` caps and the hosted `completion_result`
 * bound. Complete-path empty-after-prep remains hard-required
 * (`Completion result is required.` / `Completion result is invalid.`) so a
 * missing result cannot soft-null into a complete. Hydrate-path empty stays
 * soft-null (`optionalText` contract) so incomplete tasks remain ordinary.
 * Distinct from open SQL cntrl pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for restaurant-tasks completionResult complete /
 * hydrate. Folds NBSP, C-whitespace-trims ends only. Does not Unicode-trim
 * or collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded result and internal newlines stay intact.
 */
export function canonicalRestaurantTasksCompletionResult(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed completionResult require for complete normalization.
 * Preserves the existing `Completion result is required.` /
 * `Completion result is invalid.` error contracts from `requiredText` while
 * refusing to invent a clean result via Unicode em-space trim / `\s`
 * collapse. Empty-after-prep (including Unicode-only spaces) stays invalid
 * for this required field.
 */
export function requireCanonicalRestaurantTasksCompletionResult(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new Error("Completion result is required.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Completion result is invalid.");
  }
  const canonical = canonicalRestaurantTasksCompletionResult(value);
  if (!canonical || canonical.length > 1000) {
    throw new Error("Completion result is invalid.");
  }
  // Unicode-only spaces (for example em-space alone): prior requiredText
  // treated empty-after-Unicode-trim as invalid. Do not invent a
  // one-character result.
  if (!value.trim()) {
    throw new Error("Completion result is invalid.");
  }
  return canonical;
}

/**
 * Fail-closed completionResult normalize for row hydrate. Preserves soft
 * empty → null (`optionalText` contract) while refusing unsafe-control /
 * over-long / non-string tokens, and refusing to invent a clean result via
 * Unicode em-space trim. Null/undefined/"" remain null (optional result on
 * incomplete tasks). Error contract: `Task completion result is invalid.`
 */
export function normalizeCanonicalRestaurantTasksCompletionResult(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Task completion result is invalid.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Task completion result is invalid.");
  }
  const canonical = canonicalRestaurantTasksCompletionResult(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): optionalText
  // treated that as null; do not invent a one-character result.
  if (!value.trim()) return null;
  if (canonical.length > 1000) {
    throw new Error("Task completion result is invalid.");
  }
  return canonical;
}
