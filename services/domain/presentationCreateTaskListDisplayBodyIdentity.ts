/**
 * Create Task list display task.detail / task.body helpers (MISE-005ZW).
 *
 * Pins Create Task list-row body presentation that previously truthy-gated
 * always-passed raw free-form body text:
 *   `{task.detail ? <Text ...>{task.detail}</Text> : null}`
 *   `{task.body ? <Text ...>{task.body}</Text> : null}`
 *
 * Restaurant-shared tasks store operator body as `detail` via
 * `optionalText(row.detail, ...)` which Unicode-trims
 * (`value.trim()`), and personal operator tasks store body via
 * `normalizeOperatorTaskBody` which end-trims with Unicode-aware `\s`
 * (`/^\s+/` / `/\s+$/`). A Unicode-padded body
 * (`"\u2003Check walk-in cooler\u2003".trim() === "Check walk-in cooler"`)
 * invents a clean list-body identity before Create Task list cards render it.
 * Separately, a Unicode-only-space body (`"\u2003"`) is truthy and still
 * rendered as the entire taskBody Text, so blank-looking list body copy
 * appeared with no intentional localized none marker. Empty string has the
 * same blank-body bypass when it reaches the always-pass Text.
 *
 * List body copy is multiline operator free-text (parity with Activity
 * evidence.summary tip #1155 / MISE-005YW and Activity row event.summary tip
 * #1150 / MISE-005YR): fold NBSP to a plain space, then trim only C-locale
 * `[[:space:]]` from the ends. Do not collapse internal whitespace with `\s`
 * or Unicode `String#trim`, so internal LF/TAB/CR survive and em-space
 * padding cannot invent equality with an unpadded body. Accents and case are
 * preserved.
 *
 * Control gate matches the operator_note multiline allowlist: reject C0
 * controls and DEL except LF/TAB/CR. Full `[[:cntrl:]]` would reject the same
 * line breaks Create Task list bodies may carry into the numberOfLines={3}
 * preview.
 *
 * These are presentation **operatorTasks.list.body.none** body tokens only —
 * the Create Task list display `task.detail` (restaurant scope) and
 * `task.body` (personal scope) that fall through to that fallback when
 * soft-null. Not Create Task list display task.title (#1152 / MISE-005YT),
 * not Create Task list-row a11y task.title (#1072 / MISE-005XL), not ChoiceRow
 * dependency `label={task.title}` (#1153 / MISE-005YU), not Create Task form
 * save-path title (#880 / MISE-005QT) or body normalize paths, not Task detail
 * sharedTask.title / operational presentation surfaces (#1159 / #1160 /
 * #1165), and not Activity evidence.summary (#1155). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("operatorTasks.list.body.none")` branch owns the intentional
 * localized fallback when the raw field is present. Null / empty raw body
 * still omits the Text (optional description). Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1152 / #1153 / #1072 / #880 / #1159 / #1160 / #1165 /
 * #1155 without sharing those modules or rewriting their call sites.
 */

const C_LEADING_WHITESPACE = /^[ \t\n\v\f\r]+/;
const C_TRAILING_WHITESPACE = /[ \t\n\v\f\r]+$/;
/** Allow LF/TAB/CR; reject other C0 controls and DEL (operator_note parity). */
const UNSAFE_MULTILINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * Canonical free-text for Create Task list display bodies. Folds NBSP,
 * C-whitespace-trims ends only. Does not Unicode-trim or collapse with `\s`, so
 * em-space padding cannot invent equality with an unpadded body and internal
 * newlines stay intact.
 */
export function canonicalCreateTaskListDisplayBody(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(C_LEADING_WHITESPACE, "")
    .replace(C_TRAILING_WHITESPACE, "");
}

function hasUnsafeMultilineControls(value: string) {
  return UNSAFE_MULTILINE_CONTROL.test(value);
}

/**
 * Soft normalize for Create Task list display `task.detail` / `task.body`.
 * Preserves soft empty → null (intentional localized
 * operatorTasks.list.body.none copy when raw is present-but-unsafe) while
 * refusing to invent a clean list body via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("operatorTasks.list.body.none")` branch owns the fallback without
 * inventing a clean Create Task list body from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking
 * taskBody through the prior always-pass-body Text.
 */
export function normalizeCreateTaskListDisplayBody(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the taskBody Text instead of the intentional
  // localized operatorTasks.list.body.none copy.
  // Do not invent a clean Create Task list display body from padding.
  if (!value.trim()) return null;
  if (hasUnsafeMultilineControls(value)) return null;
  const prepared = canonicalCreateTaskListDisplayBody(value);
  if (!prepared) return null;
  // Fail closed when Unicode trim would still strip end padding (em-space).
  // End NBSP already folded to plain space by canonical prep, so ordinary
  // ASCII end whitespace is already gone; remaining Unicode padding must not
  // invent equality with an unpadded body on this display path.
  if (prepared !== prepared.trim()) return null;
  return prepared;
}
