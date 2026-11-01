/**
 * Home StatusNotice approval-title identity helpers (MISE-005VC).
 *
 * Pins Home restaurant-status `StatusNotice` title selection when it falls
 * through from `primaryApproval?.title` to the localized status key
 * (`home.status.attention_needed` / `home.status.at_risk`) outside the Expo
 * UI graph so Node tests can exercise inventing and fallback-bypass proofs
 * without loading React Native.
 *
 * Prior path used raw truthiness:
 * `primaryApproval?.title || t(statusKey)`.
 * A Unicode-only-space title (`"\u2003"`) is truthy
 * (`Boolean("\u2003") === true`) while `.trim()` empties it, so the
 * intentional localized status fallback was bypassed and the notice rendered
 * an invisible/blank headline. Separately, Unicode `.trim()` on a padded
 * approval title (`"\u2003Approve chicken reorder\u2003".trim() ===
 * "Approve chicken reorder"`) would invent a clean display title if the
 * gate used Unicode trim before rendering.
 *
 * These are Home StatusNotice **approval title** presentation tokens only —
 * not Home greeting firstName (#961 / MISE-005TW), not Home greeting
 * timezone (#997), not ApprovalsSection card body/why copy, not operating-
 * brief domain restaurant workspace (#978 / MISE-005UN), not application
 * operating-brief restaurant workspace (#746 / MISE-005LP), and not
 * operational-findings titles (#920 / MISE-005SH). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t(statusKey)` branch owns the intentional localized status headline.
 * Ordinary ASCII whitespace still trims clean. Case is left unchanged.
 *
 * Complements open Home tips #961 / #997 without sharing those modules or
 * rewriting sibling StatusNotice fields (`topRisk`, `whyItMatters`,
 * `primaryMenuRisk.itemName`).
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Home StatusNotice approval title before
 * it is rendered into the restaurant-status headline.
 */
export function asciiTrimHomeStatusApprovalTitle(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Home StatusNotice approval title under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeHomeStatusApprovalTitleToken(
  value: string
): string | null {
  const trimmed = asciiTrimHomeStatusApprovalTitle(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home StatusNotice `primaryApproval.title`.
 * Preserves soft empty → null (intentional localized status-key fallback)
 * while refusing to invent a clean approval title via Unicode em-space
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `|| t(statusKey)` branch owns the fallback without
 * inventing a clean StatusNotice headline from padding, and without letting
 * raw truthy Unicode-only space bypass that fallback.
 */
export function normalizeHomeStatusApprovalTitle(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): raw truthy padding
  // previously bypassed the intentional localized status fallback.
  if (!value.trim()) return null;
  return canonicalizeHomeStatusApprovalTitleToken(value);
}
