/**
 * Create-task screen personal due-date identity helpers (MISE-005QU).
 *
 * Pins `app/more/create-task.tsx` `save()` personal-scope due-date prep outside
 * the React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed `dueDateText` before
 * the `YYYY-MM-DD` gate and the `createOperatorTask` `dueAt` payload
 * (`'\u20032026-08-01\u2003'.trim() === '2026-08-01'`,
 * `'\u00a02026-08-01\u00a0'.trim() === '2026-08-01'`), so NBSP / em-space
 * padding invented equality with a clean ISO calendar due date.
 *
 * These are single-line ISO calendar-date due identities, not free-form
 * multiline prose. Only ASCII end trim is pinned. After ASCII prep, the value
 * must still match `YYYY-MM-DD` and parse as a real UTC calendar day;
 * Unicode-padded tokens soft to `null` so the live Create Task gate can keep
 * fail-closed due-date error behavior rather than inventing equality with an
 * unpadded date. Soft empty / Unicode-only space softs to `null` so a blank
 * due field continues to omit `dueAt` (prior `.trim()` emptiness).
 *
 * Complements open Create Task title tip #880 / MISE-005QT, Insights sales
 * soft throughDate tip #870 / MISE-005QJ, setup POS soft saleDate tip #871 /
 * MISE-005QK, and purchase-line throw-closed ISO date tip #858 / MISE-005PX
 * without sharing those modules or rewriting Create Task title / checklist
 * line / body free-text prep on this path.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized Create Task due date before it is gated
 * and stored as `dueAt`.
 */
export function asciiTrimCreateTaskDueDate(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function isExactCalendarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Canonicalize a Create Task personal due date under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or not a real `YYYY-MM-DD` calendar day.
 */
export function canonicalizeCreateTaskDueDate(value: string): string | null {
  const trimmed = asciiTrimCreateTaskDueDate(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) return null;
  if (!isExactCalendarDate(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Create Task personal `dueDateText` identity.
 * Preserves soft empty → omit `dueAt` while refusing to invent a clean ISO
 * calendar date via Unicode em-space / NBSP trim. Non-string, control-bearing,
 * Unicode-padded, and non-ISO / non-calendar tokens soft to `null` so the
 * screen can fail closed with the existing due-date error when the draft
 * still has Unicode-visible content.
 */
export function normalizeCreateTaskDueDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into a blank due date (omit dueAt).
  if (!value.trim()) return null;
  return canonicalizeCreateTaskDueDate(value);
}
