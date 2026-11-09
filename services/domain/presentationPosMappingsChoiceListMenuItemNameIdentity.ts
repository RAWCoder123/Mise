/**
 * POS mappings choice-list menuItem.name identity helpers (MISE-005AAV).
 *
 * Pins POS mapping review choice-list name chrome that previously always
 * passed free-form `menuItem.name` into the radio primary line:
 *   <Text style={styles.choiceValue}>{menuItem.name}</Text>
 *
 * A Unicode-only-space menu item name (`"\u2003"`) is non-nullish and truthy
 * as a choice-list field, so the radio row still rendered a blank-looking
 * menu-item identity with no intentional localized fallback. Empty string has
 * the same blank-looking name path. Separately, Unicode `.trim()` on a padded
 * menu item name (`"\u2003House Salad\u2003".trim() === "House Salad"`) would
 * invent a clean display menu-item identity if that gate Unicode-trimmed
 * before rendering into the POS mappings choice-list primary Text.
 *
 * Single-line menu-item name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded menu item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings choice-list** `menuItem.name` tokens
 * only — the radio primary line under the expanded mapping choice list. Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("common.none")` branch owns the intentional localized fallback. Not
 * POS mappings suggestedMenuItemName / selectedMenuItem.name (#1024 /
 * MISE-005VP), not the choice-list `menuItem.category` meta (#1206 /
 * MISE-005AAU), not Inventory detail item_name (#1017), not Insights
 * best-sellers itemName (#1196 / MISE-005AAK), and not Home StatusNotice
 * low-stock itemName (#1178 / MISE-005ZT). Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1024 / #1206 / #1017 / #1196 / #1178 without sharing those
 * modules or rewriting their call sites. #1024 explicitly left the
 * choice-list name pass-through alone; #1206 owns only the choice-list
 * category meta. This tip owns only the choice-list primary name.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings choice-list menu-item name
 * before it is rendered into the radio primary line.
 */
export function asciiTrimPosMappingsChoiceListMenuItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings choice-list menu-item name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsChoiceListMenuItemName(
  value: string
): string | null {
  const trimmed = asciiTrimPosMappingsChoiceListMenuItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings choice-list `menuItem.name` display.
 * Preserves soft empty → null (intentional localized common.none copy) while
 * refusing to invent a clean menu-item name via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("common.none")` branch owns the fallback without inventing a
 * clean POS mappings choice-list menu-item identity from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking name through the prior always-pass choice-list chrome.
 */
export function normalizePosMappingsChoiceListMenuItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the choice-list primary line as a
  // blank-looking menu-item identity.
  // Do not invent a clean POS mappings choice-list menu-item name from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsChoiceListMenuItemName(value);
}
