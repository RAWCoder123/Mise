/**
 * TodaySummary sales-spike attention-card why_it_matters identity helpers
 * (MISE-005WB).
 *
 * Pins miseDomain `buildTodaySummary` attention-card context that previously
 * selected insight prose with a raw nullish-coalescing gate:
 *
 * ```ts
 * context: spikeInsight.why_it_matters ?? "Mise is learning this pattern."
 * ```
 *
 * A Unicode-only-space `why_it_matters` (`"\u2003"`) is non-nullish under `??`,
 * so the attention card stored the padding (or bypassed the intentional
 * hard-coded `"Mise is learning this pattern."` empty-state) instead of failing
 * closed. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded why
 * prose (`"\u2003Sales spike on weekends\u2003".trim() ===
 * "Sales spike on weekends"`) would invent a clean attention-card context
 * identity before it is projected into TodaySummary / Daily Ops manager
 * attention surfaces.
 *
 * Single-line attention-context tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * unpadded why prose. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist) — this tip owns the English
 * fallback row only; multiline Daily Ops `pickSignalLine` why_it_matters
 * remains on open #867 / MISE-005QG.
 *
 * These are miseDomain **TodaySummary sales-spike attention context** tokens
 * only — the `spikeInsight.why_it_matters ?? "Mise is learning this pattern."`
 * row. Not Daily Ops `pickSignalLine` why_it_matters (#867 / MISE-005QG), not
 * operational-findings explanation `why_it_matters ?? description`
 * (#921 / MISE-005SI), not Home ApprovalsSection `whyItMatters` from
 * recommendation.reason / finding.explanation, not Home StatusNotice
 * approval titles (#1011 / MISE-005VC), and not the sibling importantInsight
 * attention path that uses `why_it_matters ?? undefined` (no English
 * empty-state inventing). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so the live `"Mise is learning this pattern."` branch
 * owns the intentional empty state. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #867 / #921 / #1011 without sharing those modules or
 * rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized TodaySummary attention why_it_matters
 * context before it is projected into the sales-spike attention card.
 */
export function asciiTrimTodayAttentionWhyItMatters(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a TodaySummary sales-spike attention why_it_matters under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * or containing ASCII controls.
 */
export function canonicalizeTodayAttentionWhyItMatters(value: string): string | null {
  const trimmed = asciiTrimTodayAttentionWhyItMatters(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one TodaySummary sales-spike attention why_it_matters
 * candidate. Preserves soft empty → null (intentional hard-coded
 * `"Mise is learning this pattern."` copy) while refusing to invent clean
 * why prose via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `"Mise is learning this pattern."` branch owns the fallback without
 * inventing clean attention context from padding, and without letting
 * non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior `??` row.
 */
export function normalizeTodayAttentionWhyItMatters(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed `"Mise is learning this pattern."` via `??`. Do not
  // invent clean attention why prose from padding.
  if (!value.trim()) return null;
  return canonicalizeTodayAttentionWhyItMatters(value);
}
