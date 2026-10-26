/**
 * Create-task screen checklist-line display helpers (MISE-005QV).
 *
 * Pins `app/more/create-task.tsx` `save()` restaurant-scope checklist prep
 * outside the React Native screen graph so Node tests can exercise inventing
 * proofs without loading Expo. The prior path Unicode-trimmed each checklist
 * line before `filter(Boolean)` and the `createSharedRestaurantTask`
 * checklist payload
 * (`'\u2003Check walk-in\u2003'.trim() === 'Check walk-in'`), so NBSP /
 * em-space padding invented equality with a clean checklist label before
 * restaurant-task evidence stored it.
 *
 * Checklist labels are single-line presentation identities inside a
 * multiline draft. They follow the same ASCII C display-prep contract used
 * by Create Task title (#880 / MISE-005QT), restaurant-tasks domain title
 * (#822 / MISE-005ON), floor-notes / operator-task title (#838 / MISE-005PD),
 * and supplier display-name prep (#410 / #691 / #692): fold NBSP to a plain
 * space, collapse C-locale `[[:space:]]`, then ASCII space trim. Unicode
 * `String#trim` / `\s` would collapse em-space and other non-C whitespace
 * the hosted COLLATE "C" path leaves alone, inventing a label the operator
 * did not type as ordinary ASCII spaces. Accents and case are preserved.
 *
 * Complements open Create Task title tip #880 / MISE-005QT and Create Task
 * due-date tip #881 / MISE-005QU without sharing those modules or rewriting
 * title / due-date / body free-text prep on this path. Intentionally does
 * not change `title.trim()`, `dueDateText.trim()`, optional body free-text,
 * assignee display `member.name?.trim()`, or restaurant-tasks domain
 * `boundedEvidence` label emptiness checks beyond the Create Task UI
 * checklist draft.
 *
 * Soft empty after prep omits the line so the prior `.trim()` +
 * `filter(Boolean)` emptiness → omit checklist item is preserved. Soft empty
 * for Unicode-only spaces (em-space alone) also omits so a blank line cannot
 * invent a one-character checklist token. Unsafe controls also soft-omit on
 * this interactive path so a bad paste cannot crash save. No new max-length
 * bound is introduced; the prior UI helper did not truncate (downstream
 * create paths keep their own caps).
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
/** Reject C0 controls and DEL for single-line checklist labels (full [[:cntrl:]]). */
const UNSAFE_CHECKLIST_CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Canonical display text for one Create Task checklist line. Folds NBSP,
 * collapses C whitespace, ASCII-space trims. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded checklist label.
 */
export function canonicalCreateTaskChecklistLine(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasUnsafeChecklistControls(value: string) {
  return UNSAFE_CHECKLIST_CONTROL.test(value);
}

/**
 * Soft normalize for one Create Task checklist draft line. Preserves soft
 * empty → `null` (prior `.trim()` emptiness → omit) while refusing to invent
 * a clean label via Unicode em-space trim / `\s` collapse. Does not throw;
 * unsafe controls soft to `null` so the form stays available.
 */
export function normalizeCreateTaskChecklistLine(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into filter(Boolean) omit. Do not invent a one-character
  // checklist token.
  if (!value.trim()) return null;
  if (hasUnsafeChecklistControls(value)) return null;
  const prepared = canonicalCreateTaskChecklistLine(value);
  if (!prepared) return null;
  return prepared;
}

/**
 * Split a Create Task checklist draft into ASCII C checklist labels.
 * Preserves prior newline split + omit-empty semantics without Unicode-trim
 * inventing clean labels from em-space / non-C padding.
 */
export function normalizeCreateTaskChecklist(value: unknown): string[] {
  if (typeof value !== "string" || value === "") return [];
  return value
    .split("\n")
    .map((line) => normalizeCreateTaskChecklistLine(line))
    .filter((label): label is string => Boolean(label));
}
