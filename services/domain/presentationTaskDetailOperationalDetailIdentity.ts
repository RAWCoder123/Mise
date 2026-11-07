/**
 * Task detail operational presentation.detail identity helpers (MISE-005ZG).
 *
 * Pins the Task detail operational instructions body that previously always
 * rendered raw `presentation.detail`:
 *   `<Text style={styles.instructionsBody}>{presentation.detail}</Text>`
 *
 * When an operational Today task has no presentation descriptor,
 * `presentOperationalTodayTask` returns
 * `detail: \`${evidenceLabel}: ${task.detail}\`` as an evidence-prefixed
 * pass-through of the free-text task detail. Empty / Unicode-only-space
 * free-text details still produce a non-nullish, truthy instructions body
 * (`"Evidence: \u2003"`), so blank-looking task instructions could appear on
 * Task detail with no intentional localized none marker. Separately, Unicode
 * `.trim()` on a padded composed detail
 * (`"Evidence: \u2003Walk fridge before open\u2003".trim()`) invents by
 * stripping trailing Unicode padding before that string is rendered into the
 * instructions body. The free-text portion alone also invents fully
 * (`"\u2003Walk fridge before open\u2003".trim() === "Walk fridge before open"`).
 *
 * Single-line operational-detail tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded task detail. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **tasks.operational.detail.none** detail tokens only
 * — the Task detail operational instructions body that falls through to that
 * fallback when soft-null. Not Task detail operational presentation.title
 * (#1160), not Task detail sharedTask.title (#1159) / sharedTask.detail
 * (#1025), not Operating Plan Timeline a11y presentation.detail (#1078), not
 * Timeline display presentation.title (#1161) / a11y title (#1077), not Home
 * HomeTaskRow (#1162), not Ask Mise priority (#1163) / answer-text (#1164),
 * and not Insights signal presentation.detail. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("tasks.operational.detail.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1160 / #1159 / #1078 / #1025 without sharing those modules
 * or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Task detail operational detail before it is
 * rendered into the instructions body Text.
 */
export function asciiTrimTaskDetailOperationalDetail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Task detail operational presentation.detail under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeTaskDetailOperationalDetail(value: string): string | null {
  const trimmed = asciiTrimTaskDetailOperationalDetail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Task detail operational `presentation.detail`. Preserves
 * soft empty → null (intentional localized tasks.operational.detail.none copy)
 * while refusing to invent a clean task detail via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("tasks.operational.detail.none")` branch owns the fallback
 * without inventing a clean Task detail operational detail from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking instructions body through the prior always-pass-detail Text.
 */
export function normalizeTaskDetailOperationalDetail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the instructions body instead of the
  // intentional localized tasks.operational.detail.none copy.
  // Do not invent a clean Task detail operational detail from padding.
  if (!value.trim()) return null;
  return canonicalizeTaskDetailOperationalDetail(value);
}
