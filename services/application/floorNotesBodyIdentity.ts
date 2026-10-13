/**
 * Floor-notes / operator-task application body free-text helpers (MISE-005PE).
 *
 * Pins application-layer `normalizeOperatorTaskBody` /
 * `normalizeFloorNoteBody` outside the repository graph so Node tests can
 * exercise inventing proofs without loading AsyncStorage. Floor-note bodies
 * previously Unicode end-trimmed through `replace(/^\s+/, "").replace(/\s+$/, "")`
 * and then collapsed per-line non-newline whitespace with `[^\S\n]+`, so
 * NBSP/em-space padding invented a clean free-text body before local
 * operator-task / floor-note rows stored it
 * (`'\u2003Ask prep\u2003'.replace(/^\s+/, "").replace(/\s+$/, "") === 'Ask prep'`;
 * mid-line em-space likewise collapsed into ordinary ASCII spaces).
 *
 * Bodies are multiline operator free-text (parity with supplier
 * `operator_note` / open SQL cntrl pin #553/#672 / MISE-005OS count-line note /
 * MISE-005OT error / MISE-005OU lesson / MISE-005OO restaurant-tasks detail /
 * MISE-005OP completionResult / MISE-005OW evidence summary /
 * MISE-005OX recommendedAction / MISE-005PA delivery notes /
 * MISE-005PB waste notes / MISE-005PC deliveryHistory notes / MISE-005EP):
 * fold NBSP to a plain space, then trim only C-locale `[[:space:]]` from the
 * ends. Do not collapse internal whitespace with `\s` or Unicode
 * `String#trim`, so internal LF/TAB/CR survive and em-space padding cannot
 * invent equality with an unpadded body. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks operators need in floor-note bodies.
 *
 * Complements open floor-notes title tip #838 / MISE-005PD, floor-notes
 * restaurant tip #730 / MISE-005LA, and floor-notes taskId tip #766 /
 * MISE-005MJ without sharing their helper modules or rewriting those paths.
 * Intentionally does not change `normalizeOperatorTaskTitle` /
 * `normalizeFloorNoteTitle`, `requireRestaurantId`, dueAt ISO prep, or
 * focus/timing enums.
 *
 * Soft empty after prep stays `null` so a task without a body stays ordinary.
 * Soft presentation preserves the prior soft truncate at 2000 characters.
 * Live create/migrate/coerce use soft canonicalize only so they do not newly
 * throw on presentation text that previously passed through `\s` end-trim +
 * per-line collapse. Fail-closed normalize may refuse over-long (>2000) and
 * unsafe-control tokens for inventing proofs.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const FLOOR_NOTES_BODY_MAX_CHARACTERS = 2000;

/**
 * Canonical free-text for floor-note / operator-task bodies. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`,
 * so em-space padding cannot invent equality with an unpadded body and
 * internal newlines stay intact.
 */
export function canonicalFloorNotesBody(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft canonicalize for `normalizeOperatorTaskBody` /
 * `normalizeFloorNoteBody`. Preserves soft empty → `null` (prior `\s`
 * end-trim empty contract) and soft truncate at 2000 while refusing to invent
 * a clean body via Unicode em-space trim / per-line `\s` collapse. Does not
 * throw.
 */
export function canonicalizeFloorNotesBody(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `\s` end-trim
  // emptied those. Do not invent a one-character floor-note body.
  if (!value.trim()) return null;
  const canonical = canonicalFloorNotesBody(value);
  if (!canonical) return null;
  return canonical.slice(0, FLOOR_NOTES_BODY_MAX_CHARACTERS);
}

/**
 * Fail-closed floor-notes-body normalize for inventing proofs / callers that
 * need a thrown contract. Soft empty → `null`. Unsafe-control / over-long /
 * non-string tokens fail with distinct messages. Live create/migrate do not
 * use this path so they retain the prior never-throw normalize contract.
 *
 * Error contracts:
 * - non-string / unsafe control → `Floor note body must be text.`
 * - over-long (>2000 after prep) → `Floor note body is outside supported limits.`
 */
export function normalizeCanonicalFloorNotesBody(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Floor note body must be text.");
  }
  if (hasUnsafeMultilineControls(value)) {
    throw new Error("Floor note body must be text.");
  }
  // Soft empty for Unicode-only space (em-space alone): prior `\s` end-trim
  // emptied those. Do not invent a one-character floor-note body.
  if (!value.trim()) return null;
  const prepared = canonicalFloorNotesBody(value);
  if (!prepared) return null;
  if (prepared.length > FLOOR_NOTES_BODY_MAX_CHARACTERS) {
    throw new Error("Floor note body is outside supported limits.");
  }
  return prepared;
}

/**
 * Fail-closed floor-notes-body require for focused inventing proofs.
 * Preserves a distinct message from sibling tips:
 * `Floor note body must be text.`
 */
export function requireCanonicalFloorNotesBody(value: unknown): string {
  const canonical = normalizeCanonicalFloorNotesBody(value);
  if (!canonical) {
    throw new Error("Floor note body must be text.");
  }
  return canonical;
}
