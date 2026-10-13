/**
 * Floor-notes / operator-task application title display helpers (MISE-005PD).
 *
 * Pins application-layer `normalizeOperatorTaskTitle` /
 * `normalizeFloorNoteTitle` outside the repository graph so Node tests can
 * exercise inventing proofs without loading AsyncStorage. Floor-note titles
 * previously Unicode-trimmed and collapsed through
 * `value.trim().replace(/\s+/g, " ")`, so NBSP/em-space padding invented a
 * clean single-line title before local operator-task / floor-note rows stored
 * it (`'\u2003Check walk-in\u2003'.trim().replace(/\s+/g, " ") ===
 * 'Check walk-in'`). Mid-string Unicode spaces were likewise collapsed into
 * ordinary ASCII spaces, inventing equality with the unpadded title.
 *
 * Presentation titles follow the same ASCII C display-prep contract used by
 * restaurant-tasks title (#822 / MISE-005ON), relatedSupplierName (#821 /
 * MISE-005OM), and supplier display-name prep (#410 / #691 / #692): fold NBSP
 * to a plain space, collapse C-locale `[[:space:]]`, then ASCII space trim.
 * Unicode `String#trim` / `\s` would collapse em-space and other non-C
 * whitespace the hosted COLLATE "C" path leaves alone, inventing a title the
 * operator did not type as ordinary ASCII spaces. Accents and case are
 * preserved.
 *
 * Complements open floor-notes restaurant tip #730 / MISE-005LA and
 * floor-notes taskId tip #766 / MISE-005MJ without sharing their helper
 * modules or rewriting those paths. Intentionally does not change
 * `normalizeOperatorTaskBody` / `normalizeFloorNoteBody` (multiline free-text
 * with `\s` line cleanup — separate tip), `requireRestaurantId`, dueAt ISO
 * prep, or focus/timing enums.
 *
 * Titles are required single-line presentation text for create, not durable
 * IDs. Soft presentation preserves the prior soft-empty → `""` contract so
 * `createFloorNote` / `createOperatorTask` still throw their existing
 * "… title is required." messages, and preserves the prior soft truncate at
 * 120 characters. Soft empty for Unicode-only spaces (em-space alone) stays
 * `""` so a missing title cannot invent a one-character title. Fail-closed
 * normalize / require helpers refuse controls and over-long tokens for
 * inventing proofs; live create/migrate keep soft canonicalize only so they
 * do not newly throw on presentation text that previously passed through
 * `.trim().replace(/\s+/g, " ")`.
 */

const C_WHITESPACE = /[ \t\n\v\f\r]+/g;
const FLOOR_NOTES_TITLE_MAX_CHARACTERS = 120;

/**
 * Canonical display text for floor-note / operator-task titles. Folds NBSP,
 * collapses C whitespace, ASCII-space trims. Does not Unicode-trim or
 * collapse with `\s`, so em-space padding cannot invent equality with an
 * unpadded title.
 */
export function canonicalFloorNotesTitle(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_WHITESPACE, " ")
    .replace(/^ +/, "")
    .replace(/ +$/, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Soft canonicalize for `normalizeOperatorTaskTitle` /
 * `normalizeFloorNoteTitle`. Preserves soft empty → `""` (prior
 * `value.trim().replace(/\s+/g, " ")` contract) and soft truncate at 120
 * while refusing to invent a clean title via Unicode em-space trim / `\s`
 * collapse. Does not throw.
 */
export function canonicalizeFloorNotesTitle(value: string): string {
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character floor-note title.
  if (!value.trim()) return "";
  return canonicalFloorNotesTitle(value).slice(0, FLOOR_NOTES_TITLE_MAX_CHARACTERS);
}

/**
 * Fail-closed floor-notes-title normalize for inventing proofs / callers that
 * need a thrown contract. Soft empty → `""`. Unsafe-control / over-long /
 * non-string tokens fail with distinct messages. Live create/migrate do not
 * use this path so they retain the prior never-throw normalize contract.
 *
 * Error contracts:
 * - non-string / unsafe control → `Floor note title must be text.`
 * - over-long (>120 after prep) → `Floor note title is outside supported limits.`
 */
export function normalizeCanonicalFloorNotesTitle(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") {
    throw new Error("Floor note title must be text.");
  }
  if (hasControlCharacters(value)) {
    throw new Error("Floor note title must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a one-character floor-note title.
  if (!value.trim()) return "";
  const prepared = canonicalFloorNotesTitle(value);
  if (!prepared) return "";
  if (prepared.length > FLOOR_NOTES_TITLE_MAX_CHARACTERS) {
    throw new Error("Floor note title is outside supported limits.");
  }
  return prepared;
}

/**
 * Fail-closed floor-notes-title require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Floor note title must be text.`
 */
export function requireCanonicalFloorNotesTitle(value: unknown): string {
  const canonical = normalizeCanonicalFloorNotesTitle(value);
  if (!canonical) {
    throw new Error("Floor note title must be text.");
  }
  return canonical;
}
