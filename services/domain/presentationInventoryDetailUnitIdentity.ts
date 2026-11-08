/**
 * Inventory detail display unit identity helpers (MISE-005AAF).
 *
 * Pins the Inventory detail free-form `item.unit` interpolations that
 * previously always passed raw `item.unit` into quantity suffixes and
 * localized labels whenever an inventory item outlook existed:
 * OperationalHero stats (`${qty} ${item.unit}`), stock-evidence count
 * values, `t("inventory.detail.perDay", { unit: item.unit })`,
 * `t("inventory.detail.parLevel", { unit: item.unit })`, and
 * `t("inventory.detail.reorderThreshold", { unit: item.unit })`.
 *
 * A Unicode-only-space unit (`"\u2003"`) is non-nullish and truthy as an
 * inventory-item field, so the detail screen still rendered blank-looking
 * unit identity in quantity suffixes (`"12.0  "`) and label shells
 * (`"Par level ()"` / `"  per day"`). Empty string has the same
 * blank-looking unit path. Separately, Unicode `.trim()` on a padded unit
 * (`"\u2003cs\u2003".trim() === "cs"`) would invent a clean display unit
 * identity if that gate Unicode-trimmed before interpolating into Inventory
 * detail unit copy.
 *
 * Single-line unit tips use ASCII end trim only and preserve NBSP (no fold
 * into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded unit. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **inventory.detail.unit.none** unit tokens only —
 * the Inventory detail display `item.unit` that falls through to that
 * fallback when soft-null. Not Inventory detail subtitle category (#1189 /
 * MISE-005AAD), not Inventory detail supplier_name (#1052 / MISE-005WR),
 * not Inventory detail title item.item_name (#1017 / MISE-005VI), not setup
 * inventory units (#861 / MISE-005QA), not inventory recipe-mapping units
 * (#864 / MISE-005QD), not inventory unit client helpers (#669 /
 * MISE-005JA), not purchase_recommendations.unit cntrl CHECK (#590 /
 * MISE-005FZ), not inventory_items.unit cntrl CHECK (#586 / MISE-005FV),
 * not Inventory hub quantity unit subtitle, not Scan Item quantity unit
 * suffix, not RecommendationDecisionRow suggested unit, and not
 * controlled inventory.ops.unit canonical labels. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("inventory.detail.unit.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1189 / #1052 / #1017 / #861 / #864 / #669 / #590 / #586
 * without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Inventory detail unit before it is
 * rendered into quantity suffixes and unit-bearing labels.
 */
export function asciiTrimInventoryDetailUnit(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Inventory detail unit under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryDetailUnit(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryDetailUnit(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Inventory detail `item.unit` display.
 * Preserves soft empty → null (intentional localized
 * inventory.detail.unit.none copy) while refusing to invent a clean unit
 * via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live
 * `|| t("inventory.detail.unit.none")` branch owns the fallback without
 * inventing a clean Inventory detail unit from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking unit through the prior always-pass-name quantity and
 * label paths.
 */
export function normalizeInventoryDetailUnit(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Inventory detail quantity suffixes and
  // unit-bearing labels as a blank-looking unit identity.
  // Do not invent a clean Inventory detail unit from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryDetailUnit(value);
}
