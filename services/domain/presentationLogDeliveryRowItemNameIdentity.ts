/**
 * Log Delivery pick-list row a11y item.item_name identity helpers (MISE-005ABO).
 *
 * Pins the Log Delivery pick-list row accessibility interpolation that
 * previously always passed raw `item.item_name` into the row a11y token:
 * `t("logDelivery.row.accessibility", { item: item.item_name })`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish and truthy, so
 * VoiceOver / TalkBack labels could include blank-looking item identity with
 * no intentional localized none marker. Empty string has the same always-pass
 * blank-looking path. Separately, Unicode `.trim()` on a padded item name
 * (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would invent a
 * clean item identity if that gate Unicode-trimmed before interpolating into
 * the Log Delivery row a11y chrome.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded item name. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **logDelivery.row.accessibility.item.none**
 * item-name tokens only — the Log Delivery pick-list row a11y `item`
 * interpolation that falls through to that fallback when soft-null. Not Log
 * Delivery pick-list OperationalRow `title={item.item_name}` display
 * (#1059 / MISE-005WY), not Log Delivery selected.item_name display
 * (#1060 / MISE-005WZ), not Log Delivery history entry.itemName
 * (#1062 / MISE-005XB), not Scan Item row item.item_name display
 * (#1061 / MISE-005XA), not Scan Item row a11y (sibling surface), not Waste
 * action reviewItem a11y itemName (#1073 / MISE-005XM), and not Inventory
 * hub / detail item_name display tips. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("logDelivery.row.accessibility.item.none")` branch owns the
 * intentional localized fallback. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1059 / #1060 / #1062 / #1061 / #1073 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Log Delivery row a11y item name before it
 * is interpolated into logDelivery.row.accessibility.
 */
export function asciiTrimLogDeliveryRowItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Log Delivery row a11y item.item_name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeLogDeliveryRowItemName(
  value: string
): string | null {
  const trimmed = asciiTrimLogDeliveryRowItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Log Delivery pick-list row a11y `item.item_name`.
 * Preserves soft empty → null (intentional localized
 * logDelivery.row.accessibility.item.none copy) while refusing to invent a
 * clean item name via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("logDelivery.row.accessibility.item.none")` branch owns the fallback
 * without inventing a clean Log Delivery row a11y name from padding, and
 * without letting non-nullish Unicode-only space or empty string interpolate
 * a blank-looking item through the prior always-pass path.
 */
export function normalizeLogDeliveryRowItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into logDelivery.row.accessibility a11y
  // instead of the intentional localized accessibility.item.none copy.
  // Do not invent a clean Log Delivery row a11y item name from padding.
  if (!value.trim()) return null;
  return canonicalizeLogDeliveryRowItemName(value);
}
