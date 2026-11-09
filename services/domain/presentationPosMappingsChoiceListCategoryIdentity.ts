/**
 * POS mappings choice-list menuItem.category identity helpers (MISE-005AAU).
 *
 * Pins POS mapping review choice-list category chrome that previously
 * truthiness-gated and always-passed free-form `menuItem.category` into the
 * radio meta line:
 *   {menuItem.category ? <Text>{menuItem.category}</Text> : null}
 *
 * A Unicode-only-space category (`"\u2003"`) is truthy
 * (`Boolean("\u2003") === true`), so the intentional hide path for empty /
 * unset categories was bypassed and the choice-list row could render a
 * blank-looking category identity under the menu-item name. Empty string is
 * falsy and already hid, but Unicode-only space is the blank-body bypass.
 * Separately, Unicode `.trim()` on a padded category
 * (`"\u2003Mains\u2003".trim() === "Mains"`) would invent a clean display
 * category identity if that gate Unicode-trimmed before rendering into the
 * POS mappings choice-list meta Text.
 *
 * Single-line category tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded category. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings choice-list** `menuItem.category`
 * tokens only — the optional radio meta line under the choice-list
 * `menuItem.name`. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `choiceListCategory ? <Text>…</Text> : null` branch
 * owns the intentional hide path. Not POS mappings suggestedMenuItemName /
 * selectedMenuItem.name (#1024 / MISE-005VP), not the choice-list
 * `menuItem.name` pass-through (still deferred beside #1024), not Inventory
 * detail subtitle category (#1189 / MISE-005AAD), not Scan Item row meta
 * category (#1190 / MISE-005AAE), not Inventory categoryIcon classify
 * (#701 / MISE-005KF), not setup POS category (#872 / MISE-005QL), and not
 * Square catalog category (#952 / MISE-005TN). Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1024 / #1189 / #1190 / #701 / #872 / #952 without sharing
 * those modules or rewriting their call sites. #1024 explicitly left the
 * choice-list pass-through alone; this tip owns only the choice-list
 * category meta, not the choice-list name.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings choice-list category before
 * it is rendered into the radio meta line.
 */
export function asciiTrimPosMappingsChoiceListCategory(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings choice-list category under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsChoiceListCategory(
  value: string
): string | null {
  const trimmed = asciiTrimPosMappingsChoiceListCategory(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings choice-list `menuItem.category` display.
 * Preserves soft empty → null (intentional hide of the radio meta line)
 * while refusing to invent a clean category via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live `choiceListCategory ? <Text>…</Text> : null` branch owns
 * the intentional hide without inventing a clean POS mappings choice-list
 * category from padding, and without letting truthy Unicode-only space
 * render a blank-looking category meta line through the prior truthiness
 * gate.
 */
export function normalizePosMappingsChoiceListCategory(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): truthy padding
  // previously still rendered as the choice-list category meta instead of
  // the intentional hide path. Do not invent a clean POS mappings
  // choice-list category from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsChoiceListCategory(value);
}
