/**
 * Inventory detail Screen title `inventory.detail.title` item_name display
 * helpers (MISE-005VI).
 *
 * Pins the Inventory detail Screen title that previously selected display text
 * with nullish coalescing before the intentional localized fallback:
 * `item?.item_name ?? t("inventory.detail.title")`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `inventory.detail.title` copy was bypassed and the Screen could render a
 * blank-looking title. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded item
 * names (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would
 * invent a clean display title if that gate Unicode-trimmed before
 * interpolation.
 *
 * Single-line item-name title tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist); multiline free-text
 * note/body display stays on open #1013 / #1014 / #840.
 *
 * These are presentation **inventory.detail.title** item_name Screen title
 * tokens only — not waste `itemName ??` (#candidate), not Settings/Gmail
 * `sender_email ??` (#candidate), not Orders gmail `fallbackSender`
 * (#candidate), not Orders detail Screen title supplier_name (#1016), not
 * Home StatusNotice approval title (#1011), not setup.fallback.* (#1012),
 * and not inventory detail add-action a11y that interpolates `item.item_name`
 * without the inventing / bypass `??` path. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live `|| t("inventory.detail.title")`
 * branch owns the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1016 / #1015 / #1014 / #1013 / #1012 / #1011 on other
 * presentation soft-null tips without sharing those modules or rewriting
 * their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized item-name Screen title before it is
 * rendered into the Inventory detail header.
 */
export function asciiTrimInventoryDetailItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Inventory detail Screen title item_name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeInventoryDetailItemName(
  value: string
): string | null {
  const trimmed = asciiTrimInventoryDetailItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Inventory detail Screen title item_name candidate.
 * Preserves soft empty → null (intentional localized inventory.detail.title
 * copy) while refusing to invent a clean item name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("inventory.detail.title")` branch owns the
 * fallback without inventing a clean title identity from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior `??` row.
 */
export function normalizeInventoryDetailItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized inventory.detail.title copy
  // via `??`. Do not invent a clean Screen title from padding.
  if (!value.trim()) return null;
  return canonicalizeInventoryDetailItemName(value);
}
