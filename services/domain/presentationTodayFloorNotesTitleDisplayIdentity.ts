/**
 * Today floor-notes display note.title identity helpers (MISE-005ABY).
 *
 * Pins the Today hub floor-notes card display title that previously always
 * passed raw `note.title` into Text:
 * `<Text style={styles.floorNoteTitle}>{note.title}</Text>`
 *
 * A Unicode-only-space floor-note title (`"\u2003"`) is non-nullish and
 * truthy, so Today floor-notes cards could render blank-looking floor-note
 * identity with no intentional localized none marker. Empty string has the
 * same always-pass blank-looking path. Separately, Unicode `.trim()` on a
 * padded floor-note title (`"\u2003Check walk-in\u2003".trim() === "Check walk-in"`)
 * would invent a clean floor-note identity if that gate Unicode-trimmed before
 * rendering into the card title chrome.
 *
 * Single-line floor-note-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an unpadded
 * floor-note title. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **today.floorNotes.noteTitle.none** title tokens only —
 * the floor-notes card display `note.title` that falls through to that fallback
 * when soft-null. Not the floor-notes row a11y `note.title` (#1084 /
 * MISE-005XX), not floor-note body display (#839 / MISE-005PE), not create-path
 * `normalizeFloorNoteTitle` (#838 / MISE-005PD), not Create Task list-row a11y
 * `task.title` (#1072 / MISE-005XL), not Home HomeTaskRow display
 * presentation.title (#1162 / MISE-005ZD), and not Operating Plan Timeline
 * display presentation.title (#1161 / MISE-005ZC). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("today.floorNotes.noteTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1084 / #838 / #839 / #1162 / #1161 without sharing those
 * modules or rewriting their call sites. Alone-OK: #1084 explicitly deferred
 * display Text `{note.title}`; this tip owns that display gate only.
 * Ordinary conflict only on the Today display title Text line + new identity
 * module.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Today floor-notes display title before it is
 * rendered into the card title.
 */
export function asciiTrimTodayFloorNotesTitleDisplay(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Today floor-notes display note.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeTodayFloorNotesTitleDisplay(
  value: string
): string | null {
  const trimmed = asciiTrimTodayFloorNotesTitleDisplay(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Today floor-notes display `note.title`. Preserves soft
 * empty → null (intentional localized noteTitle.none copy) while refusing to
 * invent a clean floor-note title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("today.floorNotes.noteTitle.none")` branch owns the fallback without
 * inventing a clean display title from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking title
 * through the prior always-pass path.
 */
export function normalizeTodayFloorNotesTitleDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into floor-notes card title instead of the
  // intentional localized noteTitle.none copy.
  // Do not invent a clean Today floor-notes display title from padding.
  if (!value.trim()) return null;
  return canonicalizeTodayFloorNotesTitleDisplay(value);
}
