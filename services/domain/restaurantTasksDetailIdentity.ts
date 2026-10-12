/**
 * Restaurant-tasks domain detail free-text helpers (MISE-005OO).
 *
 * Pins domain-layer `normalizeCreateRestaurantTaskInput` /
 * `restaurantTaskFromPersistedRow` `detail` outside the repository graph so
 * Node tests can exercise inventing proofs without loading Supabase or demo
 * storage. Task detail previously Unicode-trimmed through shared
 * `optionalText` (`.trim()` only), so NBSP/em-space padding invented a clean
 * detail string before create RPC arguments or hydrated task rows stored it
 * (`'\u2003Count the walk-in case.\u2003'.trim() === 'Count the walk-in case.'`).
 *
 * Detail is multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #554 / MISE-005EP): fold NBSP to a
 * plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so
 * internal LF/TAB/CR survive and em-space padding cannot invent equality
 * with an unpadded detail. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the
 * same line breaks operators need in task detail.
 *
 * Complements open restaurant-tasks clientTaskId tip #808 / MISE-005NZ,
 * correlationId tip #809 / MISE-005OA, dependencyIds tip #810 / MISE-005OB,
 * assigneeUserId tip #811 / MISE-005OC, relatedInventoryItemId tip #812 /
 * MISE-005OD, relatedOrderId tip #813 / MISE-005OE, relatedRecommendationId
 * tip #814 / MISE-005OF, createdBy tip #815 / MISE-005OG, completedBy tip
 * #816 / MISE-005OH, locationId tip #817 / MISE-005OI, sourceReference tip
 * #820 / MISE-005OL, relatedSupplierName tip #821 / MISE-005OM, title tip
 * #822 / MISE-005ON, restaurant tip #739 / MISE-005LI, and application
 * taskId tip #762 / MISE-005MF without sharing their helper modules or
 * rewriting those paths. Intentionally does not change other
 * `requiredText` / `optionalText` surfaces (`restaurantId`, `clientTaskId`,
 * `correlationId`, `dependencyIds`, `assigneeUserId`, `title`, `createdBy`,
 * `relatedInventoryItemId`, `relatedOrderId`, `relatedRecommendationId`,
 * `relatedSupplierName`, `sourceReference`, `taskId` on complete,
 * `completedBy`, `locationId`, or completion free-text). Those remain on
 * their existing Unicode-trim contracts in this tip.
 *
 * Max length stays 2000 to match the prior `optionalText(..., 2000, ...)`
 * cap and the hosted `detail` bound. Empty-after-prep remains soft-null so
 * a task without detail stays ordinary and fully recordable. Distinct from
 * open SQL cntrl pin #554.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for restaurant-tasks detail create / hydrate. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded detail
 * and internal newlines stay intact.
 */
export function canonicalRestaurantTasksDetail(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Fail-closed detail normalize for create normalization and row hydrate.
 * Preserves soft empty → null (`optionalText` contract) while refusing
 * unsafe-control / over-long / non-string tokens, and refusing to invent a
 * clean detail via Unicode em-space trim. Null/undefined/"" remain null
 * (optional detail). Error contract: `Task detail is invalid.`
 */
export function normalizeCanonicalRestaurantTasksDetail(
  value: unknown
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Task detail is invalid.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Task detail is invalid.");
  }
  const canonical = canonicalRestaurantTasksDetail(value);
  if (!canonical) return null;
  // Preserve soft empty for Unicode-only space (em-space alone): optionalText
  // treated that as null; do not invent a one-character detail.
  if (!value.trim()) return null;
  if (canonical.length > 2000) {
    throw new Error("Task detail is invalid.");
  }
  return canonical;
}
