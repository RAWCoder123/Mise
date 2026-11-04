/**
 * Operating Plan Timeline task-row a11y presentation.detail identity helpers
 * (MISE-005XR).
 *
 * Pins the Today OperatingPlanTimeline accessibility interpolation that
 * previously always passed raw `presentation.detail` into the template:
 * `accessibilityLabel={t("today.task.accessibility", { title, detail, action })}`
 *
 * A Unicode-only-space task detail (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking task detail with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded task detail
 * (`"\u2003Walk fridge before open\u2003".trim() === "Walk fridge before open"`)
 * would invent a clean task detail if that gate Unicode-trimmed before
 * interpolating into the timeline-row a11y chrome.
 *
 * Operator-authored restaurant-task details and operational Today details flow
 * through `presentOperatingPlanItem` into `presentation.detail` without
 * soft-null. Single-line a11y detail tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded task detail. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist) because this token is
 * interpolated into a single-line accessibility label.
 *
 * These are presentation **today.task.detail.none** detail tokens only — the
 * OperatingPlanTimeline a11y `detail` interpolation that falls through to that
 * fallback when soft-null. Not the timeline display Text
 * `{presentation.title}`, not `presentation.title` a11y chrome (#1077), not
 * `actionLabel` a11y chrome, not Create Task list-row a11y title (#1072), not
 * Activity expand a11y title (#1071), not Daily Phase Brief finding-row a11y
 * title (#1076), and not Home ApprovalsSection card.title (#1049). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("today.task.detail.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1077 / #1076 / #1072 / #1071 / #1049 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Operating Plan Timeline a11y detail before it
 * is interpolated into the accessibility label.
 */
export function asciiTrimOperatingPlanTaskDetail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Operating Plan Timeline a11y presentation.detail under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeOperatingPlanTaskDetail(value: string): string | null {
  const trimmed = asciiTrimOperatingPlanTaskDetail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Operating Plan Timeline a11y `presentation.detail`.
 * Preserves soft empty → null (intentional localized today.task.detail.none
 * copy) while refusing to invent a clean task detail via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("today.task.detail.none")` branch owns the
 * fallback without inventing a clean timeline-row a11y detail from padding,
 * and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking detail through the prior always-pass path.
 */
export function normalizeOperatingPlanTaskDetail(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into timeline-row a11y instead of the
  // intentional localized today.task.detail.none copy.
  // Do not invent a clean Operating Plan Timeline a11y detail from padding.
  if (!value.trim()) return null;
  return canonicalizeOperatingPlanTaskDetail(value);
}
