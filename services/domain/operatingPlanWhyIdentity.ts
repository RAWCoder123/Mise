/**
 * Daily Operating Plan why / completion-result free-text helpers (MISE-005QE).
 *
 * Pins `whyForTask` and `completionResultForTask` prep outside the repository
 * graph so Node tests can exercise inventing proofs without loading Supabase
 * or AsyncStorage. Those helpers previously Unicode-trimmed
 * `recommendation.reason`, `task.detail`, matched activity `summary`, and
 * matched activity `title` before storing the trimmed result on the plan item
 * (`'\u2003Need reorder before lunch\u2003'.trim() === 'Need reorder before lunch'`).
 *
 * Operating-plan why tokens and completion-result prose are multiline operator /
 * system free-text (parity with open MISE-005PT inventory-operation note /
 * MISE-005PF supplier operator_note / MISE-005OO restaurant-tasks detail /
 * MISE-005OP completionResult / MISE-005OW evidence summary): fold NBSP to a
 * plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so internal
 * LF/TAB/CR survive and em-space padding cannot invent equality with an
 * unpadded why token. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in task detail / activity summaries.
 *
 * Soft empty after prep stays `null` so why/completion selection can fall
 * through to the next authoritative source. Unsafe-control tokens also soft
 * to `null` on this read-side projection so a bad activity summary cannot
 * crash Daily Operating Plan construction (fail-closed persist tips own throw
 * contracts elsewhere). No new max-length bound is introduced; the prior
 * helpers did not truncate.
 *
 * Complements open prep-window token tip (#684) and restaurant-workspace tip
 * (#736) without sharing those modules or rewriting `restaurantId.trim()` /
 * `evidenceFromPrepWindows` on main. Those remain on their existing contracts
 * in this tip.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for operating-plan why / completion-result tokens. Folds
 * NBSP, C-whitespace-trims ends only. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded why token
 * and internal newlines stay intact.
 */
export function canonicalOperatingPlanWhyText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Daily Operating Plan why / completion-result selection.
 * Preserves soft empty → `null` (prior `.trim()` emptiness fallthrough) while
 * refusing to invent a clean why token via Unicode em-space trim. Does not
 * throw; unsafe controls soft to `null` so plan construction stays available.
 */
export function normalizeOperatingPlanWhyText(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those and fell through. Do not invent a one-character why token.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalOperatingPlanWhyText(value);
  if (!prepared) return null;
  return prepared;
}
