/**
 * Floor-notes / operator-task dueAt helpers (MISE-005RZ).
 *
 * Pins `services/application/floorNotes.ts` `normalizeDueAt` prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs
 * without loading Expo. The prior path Unicode-trimmed `dueAt` before the
 * `YYYY-MM-DD` / ISO parse gate and durable AsyncStorage write
 * (`'\u20032026-08-05\u2003'.trim() === '2026-08-05'` →
 * `'2026-08-05T00:00:00.000Z'`, and
 * `'\u20032026-08-05T12:30:00.000Z\u2003'.trim() ===
 * '2026-08-05T12:30:00.000Z'`), so NBSP / em-space padding invented a clean
 * stored due instant. Unicode-only space also invented the empty / omit-dueAt
 * branch via `'\u2003'.trim() === ''`.
 *
 * These are single-line due identities only — not Create Task UI
 * `dueDateText` prep (open #881 / MISE-005QU), not floor-notes titles
 * (open #838 / MISE-005PD), not floor-notes body (open #839 / MISE-005PE),
 * not Insights soft throughDate (open #870 / MISE-005QJ), and not
 * purchase-line throw-closed ISO dates (open #858 / MISE-005PX). Soft empty
 * (ASCII whitespace or Unicode-only space) stays `null` so callers keep the
 * prior omit-dueAt contract. Ordinary ASCII whitespace still trims clean
 * before calendar / ISO parse. Unicode-padded or control-bearing drafts fail
 * closed as `null` so padded `"2026-08-05"` cannot invent a stored dueAt.
 *
 * Complements open Create Task due-date tip #881 / MISE-005QU without sharing
 * that module. Leave Create Task UI `dueDateText` alone until #881 owns that
 * surface on main.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized floor-notes dueAt before durable storage.
 */
export function asciiTrimFloorNotesDueAt(value: string) {
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
 * Canonicalize a floor-notes / operator-task dueAt under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, containing
 * ASCII controls, or not a real calendar day / parseable instant. Otherwise
 * returns the durable ISO instant (date-only → start-of-day UTC).
 */
export function canonicalizeFloorNotesDueAt(value: string): string | null {
  const trimmed = asciiTrimFloorNotesDueAt(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;

  if (/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    if (!isExactCalendarDate(trimmed)) return null;
    return `${trimmed}T00:00:00.000Z`;
  }

  if (!Number.isFinite(Date.parse(trimmed))) return null;
  return new Date(trimmed).toISOString();
}

/**
 * Soft normalize for floor-notes / operator-task `dueAt` identity.
 * Preserves soft empty → `null` (prior `.trim()` emptiness → omit dueAt)
 * while refusing to invent a clean ISO due instant via Unicode em-space /
 * NBSP trim. Non-string, control-bearing, Unicode-padded, and unparseable
 * tokens soft to `null`.
 */
export function normalizeFloorNotesDueAt(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into omit-dueAt.
  if (!value.trim()) return null;
  return canonicalizeFloorNotesDueAt(value);
}
