/**
 * POS mappings menu-item name identity helpers (MISE-005VP).
 *
 * Pins POS mapping review display that previously selected text with nullish
 * coalescing before intentional localized fallbacks:
 * `mapping.suggestedMenuItemName ?? t("common.none")` and
 * `selectedMenuItem?.name ?? t("pos.mappings.chooseItem")`.
 *
 * A Unicode-only-space menu item name (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional `common.none` /
 * `pos.mappings.chooseItem` copy was bypassed and the mapping card could
 * render a blank-looking suggestion or selected-item line. Empty string has
 * the same `??` bypass (`("" ?? FALLBACK) === ""`). Separately, Unicode
 * `.trim()` on a padded menu item name
 * (`"\u2003Classic Burger\u2003".trim() === "Classic Burger"`) would invent a
 * clean display menu-item identity if that gate Unicode-trimmed before
 * rendering into the POS mappings suggestion or choice control.
 *
 * Single-line menu-item name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded menu item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings** suggestedMenuItemName /
 * selectedMenuItem.name tokens only — the suggestion value that falls
 * through to `common.none` and the choice-control value that falls through
 * to `pos.mappings.chooseItem`. Not the choice-list `menuItem.name`
 * pass-through (no inventing/`??` fallback path), not Settings workspace
 * cuisine_type (#1023 / MISE-005VO), not Sales Import hero restaurant-name
 * (#1022 / MISE-005VN), not Settings hub restaurant-name (#1021 /
 * MISE-005VM), not Orders gmail connected-body sender (#1020), not
 * Settings/Gmail sender_email (#1019), not waste itemName (#1018), not
 * Inventory detail item_name (#1017), not Orders detail supplier_name
 * (#1016), and not Home ApprovalsSection card titles. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("common.none")` / `|| t("pos.mappings.chooseItem")` branches own
 * the intentional localized fallbacks. Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1023 / #1022 / #1021 / #1020 / #1019 / #1018 / #1017 /
 * #1016 on other presentation tips without sharing those modules or
 * rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings menu-item name before it is
 * rendered into the suggestion value or choice control.
 */
export function asciiTrimPosMappingsMenuItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings menu-item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsMenuItemName(
  value: string
): string | null {
  const trimmed = asciiTrimPosMappingsMenuItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings `suggestedMenuItemName` /
 * `selectedMenuItem.name` display. Preserves soft empty → null (intentional
 * localized common.none / pos.mappings.chooseItem copy) while refusing to
 * invent a clean menu-item name via Unicode em-space / NBSP trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t(...)` branches own the fallback without inventing a clean menu-item
 * identity from padding, and without letting non-nullish Unicode-only space
 * or empty string bypass that fallback through the prior `??` rows.
 */
export function normalizePosMappingsMenuItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized common.none /
  // pos.mappings.chooseItem copy via `??`. Do not invent a clean POS
  // mappings menu-item label from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsMenuItemName(value);
}
