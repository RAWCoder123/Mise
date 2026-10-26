/**
 * Create-task screen title display helpers (MISE-005QT).
 *
 * Pins `app/more/create-task.tsx` `save()` title prep outside the React Native
 * screen graph so Node tests can exercise inventing proofs without loading
 * Expo. The prior path Unicode-trimmed the draft title before emptiness
 * checks and both create payloads
 * (`'\u2003Count walk-in\u2003'.trim() === 'Count walk-in'`), so NBSP /
 * em-space padding invented equality with a clean task title before
 * `createSharedRestaurantTask` / `createOperatorTask` received it.
 *
 * Presentation titles follow the same ASCII C display-prep contract used by
 * restaurant-tasks domain title (#822 / MISE-005ON), floor-notes /
 * operator-task title (#838 / MISE-005PD), relatedSupplierName (#821 /
 * MISE-005OM), and supplier display-name prep (#410 / #691 / #692): fold NBSP
 * to a plain space, collapse C-locale `[[:space:]]`, then ASCII space trim.
 * Unicode `String#trim` / `\s` would collapse em-space and other non-C
 * whitespace the hosted COLLATE "C" path leaves alone, inventing a title the
 * operator did not type as ordinary ASCII spaces. Accents and case are
 * preserved.
 *
 * Complements open restaurant-tasks title tip #822 / MISE-005ON and
 * floor-notes title tip #838 / MISE-005PD without sharing their helper
 * modules or rewriting those domain/application paths. Intentionally does
 * not change create-task due-date ISO prep (`dueDateText.trim()`), checklist
 * line `.trim()`, optional body free-text, assignee display
 * `member.name?.trim()`, or restaurant/personal create payloads beyond the
 * title gate.
 *
 * Soft empty after prep stays `null` so the Create Task UI keeps the prior
 * `.trim()` emptiness → title-required error. Soft empty for Unicode-only
 * spaces (em-space alone) stays `null` so a missing title cannot invent a
 * one-character title. Unsafe controls also soft to `null` on this
 * interactive path so a bad paste cannot crash save. No new max-length bound
 * is introduced; the prior UI helper did not truncate (downstream create
 * paths keep their own caps).
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
/** Reject C0 controls and DEL for single-line titles (full [[:cntrl:]]). */
const UNSAFE_TITLE_CONTROL = /[\u0000-\u001f\u007f]/;

/**
 * Canonical display text for Create Task draft titles. Folds NBSP, collapses
 * C whitespace, ASCII-space trims. Does not Unicode-trim or collapse with
 * `\s`, so em-space padding cannot invent equality with an unpadded title.
 */
export function canonicalCreateTaskTitle(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasUnsafeTitleControls(value: string) {
  return UNSAFE_TITLE_CONTROL.test(value);
}

/**
 * Soft normalize for Create Task save. Preserves soft empty → `null` (prior
 * `.trim()` emptiness → title-required error) while refusing to invent a
 * clean title via Unicode em-space trim / `\s` collapse. Does not throw;
 * unsafe controls soft to `null` so the form stays available.
 */
export function normalizeCreateTaskTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the title-required error. Do not invent a
  // one-character title token.
  if (!value.trim()) return null;
  if (hasUnsafeTitleControls(value)) return null;
  const prepared = canonicalCreateTaskTitle(value);
  if (!prepared) return null;
  return prepared;
}
