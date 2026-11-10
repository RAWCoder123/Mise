/**
 * Home ApprovalsSection approve/review button a11y card.title helpers
 * (MISE-005ACA).
 *
 * Pins the Home ApprovalsSection Needs-your-approval action button
 * accessibility interpolation that previously had no accessibilityLabel at
 * all — VoiceOver / TalkBack only heard the visible "Approve" / "Review" /
 * "Approving…" chrome, with no approval-card title identity. When a title is
 * supplied for the new a11y chrome, empty / Unicode-only-space titles must
 * not interpolate blank-looking identity, and Unicode `.trim()` on padded
 * titles must not invent a clean approval title before a11y interpolation.
 *
 * Single-line approval-title tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded approval title. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **home.approvals.approveAccessibility.title.none**
 * approval-title tokens only — the Home ApprovalsSection approve/review
 * Button `accessibilityLabel` title interpolation that falls through to that
 * fallback when soft-null. Not Home ApprovalsSection cardTitle Text display
 * (#1049 / MISE-005WO), not recommendedAction cardBody (#1134 / MISE-005YB),
 * not whyItMatters meta line (#1135 / MISE-005YC), not Home StatusNotice
 * approval titles (#1011 / MISE-005VC), not Daily Brief approve a11y
 * (#1144 / related), and not Orders recommendation approveAccessibility.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("home.approvals.approveAccessibility.title.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1049 / #1134 / #1135 / #1011 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home Approvals approve-button a11y title
 * before it is interpolated into home.approvals.approveAccessibility /
 * home.approvals.reviewAccessibility.
 */
export function asciiTrimHomeApprovalsApproveButtonTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home Approvals approve-button a11y card.title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeApprovalsApproveButtonTitle(
  value: string
): string | null {
  const trimmed = asciiTrimHomeApprovalsApproveButtonTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home ApprovalsSection approve/review Button a11y
 * `card.title`. Preserves soft empty → null (intentional localized
 * home.approvals.approveAccessibility.title.none copy) while refusing to
 * invent a clean approval title via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("home.approvals.approveAccessibility.title.none")` branch owns the
 * fallback without inventing a clean Approvals approve-button a11y title from
 * padding, and without letting non-nullish Unicode-only space or empty string
 * interpolate a blank-looking title through the a11y chrome.
 */
export function normalizeHomeApprovalsApproveButtonTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // must not interpolate into approve/review a11y instead of the intentional
  // localized approveAccessibility.title.none copy.
  // Do not invent a clean Home Approvals approve-button a11y title from padding.
  if (!value.trim()) return null;
  return canonicalizeHomeApprovalsApproveButtonTitle(value);
}
