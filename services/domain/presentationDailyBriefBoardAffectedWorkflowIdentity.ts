/**
 * Daily Brief Board finding.affectedWorkflow helpers (MISE-005AAQ).
 *
 * Pins Daily Brief Board workflow meta interpolation that previously always
 * passed raw `finding.affectedWorkflow` into the workflow Text:
 *   `t("dailyBrief.workflow", { workflow: finding.affectedWorkflow })`
 *
 * `affectedWorkflow` is typed as free-form `string` on OperationalFinding.
 * Writers include ad-hoc workflow tokens (`inventory_and_ordering`,
 * `daily_sales_import`, `inventory_setup`, `recipe_mapping`) and a direct
 * passthrough of `insight.insight_type`. The Board display boundary has no
 * prep gate, so this is not a controlled-enum presentation path.
 *
 * A Unicode-only-space workflow (`"\u2003"`) is non-nullish and still rendered
 * into the `{workflow}` slot, so blank-looking workflow identity appeared on
 * Daily Brief finding cards (`"Workflow:  "`) with no intentional localized
 * fallback. Empty string has the same blank-body bypass. Separately, Unicode
 * `.trim()` on a padded workflow
 * (`"\u2003inventory_and_ordering\u2003".trim() === "inventory_and_ordering"`)
 * would invent a clean display workflow if that gate Unicode-trimmed before
 * interpolating into dailyBrief.workflow copy.
 *
 * Single-line affected-workflow tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded workflow token. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **dailyBrief.workflow.none** workflow tokens only —
 * the Daily Brief Board `finding.affectedWorkflow` that falls through to that
 * fallback when soft-null. Not Board finding.title (#1145 / MISE-005YM), not
 * Board explanation (#1142 / MISE-005YJ), not Board recommendedAction
 * (#1143 / MISE-005YK), not effectiveRecommendedAction annotation
 * (#1144 / MISE-005YL), not missingData items (#1180 / MISE-005ZV), not card
 * header / action a11y finding.title (#1075 / #1074), and not domain finding
 * writers in operationalFindings.ts. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("dailyBrief.workflow.none")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean. Controlled-looking
 * ASCII-safe tokens remain durable when they are already ASCII-safe.
 *
 * Complements open #1145 / #1142 / #1143 / #1144 / #1180 / #1075 / #1074
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Daily Brief Board affectedWorkflow before it
 * is interpolated into dailyBrief.workflow `{workflow}`.
 */
export function asciiTrimDailyBriefBoardAffectedWorkflow(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Daily Brief Board affectedWorkflow under ASCII C. Returns
 * null when empty after ASCII trim, still Unicode-padded, or containing ASCII
 * controls.
 */
export function canonicalizeDailyBriefBoardAffectedWorkflow(
  value: string
): string | null {
  const trimmed = asciiTrimDailyBriefBoardAffectedWorkflow(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Daily Brief Board `finding.affectedWorkflow` display.
 * Preserves soft empty → null (intentional localized workflow.none copy) while
 * refusing to invent a clean workflow via Unicode em-space / NBSP trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| t("dailyBrief.workflow.none")` branch owns the fallback without
 * inventing a clean Board workflow from padding, and without letting
 * non-nullish Unicode-only space or empty string render a blank-looking
 * `{workflow}` slot through the prior always-pass workflow interpolation.
 */
export function normalizeDailyBriefBoardAffectedWorkflow(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into dailyBrief.workflow as a blank-looking
  // workflow identity.
  // Do not invent a clean Daily Brief Board affectedWorkflow from padding.
  if (!value.trim()) return null;
  return canonicalizeDailyBriefBoardAffectedWorkflow(value);
}
