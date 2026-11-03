/**
 * Waste action reviewItem a11y itemName identity helpers (MISE-005XM).
 *
 * Pins the Waste top-items row accessibility interpolation that previously
 * always passed raw `item.itemName` into the review-item a11y token:
 * `t("waste.action.reviewItem", { item: item.itemName })`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking item identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded item name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean item identity if that gate Unicode-trimmed before interpolating into
 * the review-item a11y chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **waste.action.reviewItem.item.none** item-name
 * tokens only — the Waste top-items row a11y `item` interpolation that falls
 * through to that fallback when soft-null. Not OperationalRow
 * `title={item.itemName}` display chrome, not waste recent-event /
 * action-copy `waste.event.unknownItem` paths (#1018 / MISE-005VJ), not
 * Daily Report waste.topItem itemName (#1064 / MISE-005XD), not Daily Report
 * sales top-sellers item.itemName (#1063), not Inventory hub item.item_name
 * (#1056), not RecommendationDecisionRow item_name (#1055), and not Create
 * Task list-row a11y title (#1072). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("waste.action.reviewItem.item.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1018 / #1064 / #1063 / #1056 / #1055 / #1072 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Waste review-item a11y item name before it
 * is interpolated into waste.action.reviewItem.
 */
export function asciiTrimWasteActionReviewItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Waste review-item a11y itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeWasteActionReviewItemName(
  value: string
): string | null {
  const trimmed = asciiTrimWasteActionReviewItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Waste review-item a11y `item.itemName`. Preserves soft
 * empty → null (intentional localized reviewItem.item.none copy) while
 * refusing to invent a clean item name via Unicode em-space / NBSP trim. Does
 * not throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| t("waste.action.reviewItem.item.none")` branch owns the fallback
 * without inventing a clean review-item a11y name from padding, and without
 * letting non-nullish Unicode-only space or empty string interpolate a
 * blank-looking item through the prior always-pass path.
 */
export function normalizeWasteActionReviewItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into waste.action.reviewItem a11y instead
  // of the intentional localized reviewItem.item.none copy.
  // Do not invent a clean Waste review-item a11y item name from padding.
  if (!value.trim()) return null;
  return canonicalizeWasteActionReviewItemName(value);
}
