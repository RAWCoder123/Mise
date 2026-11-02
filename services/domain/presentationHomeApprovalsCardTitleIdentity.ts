/**
 * Home ApprovalsSection card.title identity helpers (MISE-005WO).
 *
 * Pins Home ApprovalsSection approval-card title presentation that previously
 * always passed raw `card.title` into the cardTitle Text:
 * `<Text style={styles.cardTitle}>{card.title}</Text>`
 *
 * A Unicode-only-space approval title (`"\u2003"`) is non-nullish and still
 * rendered as the entire cardTitle line, so blank-looking approval identity
 * appeared on Needs-your-approval cards with no intentional localized
 * fallback. Empty string has the same blank-title bypass. Separately,
 * Unicode `.trim()` on a padded approval title
 * (`"\u2003Approve chicken reorder\u2003".trim() === "Approve chicken reorder"`)
 * would invent a clean display approval title if that gate Unicode-trimmed
 * before rendering into the ApprovalsSection cardTitle.
 *
 * Single-line approval-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded approval title. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **home.approvals.cardTitle.none** approval-title
 * tokens only — the Home ApprovalsSection `card.title` that falls through to
 * that fallback when soft-null. Not Home StatusNotice approval titles
 * (#1011 / MISE-005VC), not Home greeting restaurant.name (#1044 /
 * MISE-005WJ), not Home greeting firstName (#961 / MISE-005TW), not
 * ApprovalsSection `recommendedAction` / `whyItMatters` body copy, not
 * operating-brief domain title construction, not Ask Mise / Team / Settings
 * workspace / Gmail / Autonomy / Memory / Activity / Support / Privacy /
 * Count / Insights restaurant.name subtitle tips. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.approvals.cardTitle.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1011 / #1048 / #1047 / #1046 / #1045 / #1044 / #1043 /
 * #1042 / #1041 / #1040 / #1039 / #1037 / #1036 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home ApprovalsSection card title before it
 * is rendered into the cardTitle Text.
 */
export function asciiTrimHomeApprovalsCardTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home ApprovalsSection card title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeApprovalsCardTitle(
  value: string
): string | null {
  const trimmed = asciiTrimHomeApprovalsCardTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home ApprovalsSection `card.title` display. Preserves
 * soft empty → null (intentional localized cardTitle.none copy) while
 * refusing to invent a clean approval title via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("home.approvals.cardTitle.none")` branch owns the fallback
 * without inventing a clean ApprovalsSection card title from padding, and
 * without letting non-nullish Unicode-only space or empty string render a
 * blank-looking cardTitle through the prior always-pass-title row.
 */
export function normalizeHomeApprovalsCardTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the cardTitle Text instead of the
  // intentional localized cardTitle.none copy.
  // Do not invent a clean Home ApprovalsSection card title from padding.
  if (!value.trim()) return null;
  return canonicalizeHomeApprovalsCardTitle(value);
}
