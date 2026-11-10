/**
 * Today floor-notes display note.body identity helpers (MISE-005ABZ).
 *
 * Pins the Today hub floor-notes card display body that previously
 * truthy-gated always-passed raw `note.body`:
 * `{note.body ? (
 *   <Text numberOfLines={2} style={styles.floorNoteDetail}>
 *     {note.body}
 *   </Text>
 * ) : null}`
 *
 * Floor-note / operator-task bodies are Unicode end-trimmed on write through
 * `normalizeOperatorTaskBody` / `normalizeFloorNoteBody`
 * (`value.replace(/^\s+/, "").replace(/\s+$/, "")`). A Unicode-padded body
 * (`"\u2003Ask prep before open\u2003".replace(/^\s+/, "").replace(/\s+$/, "")
 * === "Ask prep before open"`) invents a clean floor-note body identity before
 * Today cards render it. Separately, a Unicode-only-space body (`"\u2003"`) is
 * truthy (`Boolean("\u2003") === true`) and still rendered as the entire
 * floorNoteDetail Text, so blank-looking body copy appeared with no intentional
 * omit. Empty string has the same blank-body bypass when it reaches the
 * always-pass Text.
 *
 * Floor-note body copy is multiline operator free-text (parity with Create Task
 * list display body tip #1181 / MISE-005ZW, Activity evidence.summary tip #1155 /
 * MISE-005YW, and write-path floor-notes body tip #839 / MISE-005PE): fold NBSP
 * to a plain space, then trim only C-locale `[[:space:]]` from the ends. Do not
 * collapse internal whitespace with `\s` or Unicode `String#trim`, so internal
 * LF/TAB/CR survive and em-space padding cannot invent equality with an
 * unpadded body. Accents and case are preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks floor-note bodies may carry into the numberOfLines={2} preview.
 *
 * These are presentation Today floor-notes display `note.body` tokens only —
 * the floor-notes card detail Text that soft-nulls to omit (optional body).
 * Not the floor-notes display `note.title` (#1235 / MISE-005ABY), not the
 * floor-notes row a11y `note.title` (#1084 / MISE-005XX), not create-path
 * `normalizeFloorNoteBody` (#839 / MISE-005PE), not create-path
 * `normalizeFloorNoteTitle` (#838 / MISE-005PD), not Create Task list display
 * body (#1181 / MISE-005ZW), and not Home / Timeline task title display tips.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so the live
 * omit branch owns intentional absence without inventing clean body copy from
 * padding, and without letting non-nullish Unicode-only space render a
 * blank-looking detail line through the prior truthy always-pass path.
 * Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1235 / #1084 / #839 / #838 / #1181 without sharing those
 * modules or rewriting their call sites. Alone-OK: #1235 owns display title
 * only; #839 owns write-path body normalize; this tip owns Today display body
 * gate only. Ordinary conflict only on the Today display body Text block +
 * new identity module.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Today floor-notes display bodies. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded body and internal
 * newlines stay intact.
 */
export function canonicalTodayFloorNotesBodyDisplay(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Today floor-notes display `note.body`. Preserves soft
 * empty → null (intentional omit of optional detail Text) while refusing to
 * invent a clean floor-note body via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live omit
 * branch owns absence without inventing clean display body from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking floorNoteDetail through the prior truthy always-pass path.
 */
export function normalizeTodayFloorNotesBodyDisplay(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the floorNoteDetail Text instead of omitting.
  // Do not invent a clean Today floor-notes display body from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalTodayFloorNotesBodyDisplay(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded body on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
