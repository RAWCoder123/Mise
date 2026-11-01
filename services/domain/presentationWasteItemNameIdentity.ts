/**
 * Waste / daily-report `waste.event.unknownItem` itemName display helpers
 * (MISE-005VJ).
 *
 * Pins the waste recent-event title and waste/daily-report action-copy item
 * interpolations that previously selected display text with nullish
 * coalescing before the intentional localized fallback:
 * `event.itemName ?? t("waste.event.unknownItem")` and
 * `item?.itemName ?? t("waste.event.unknownItem")`.
 *
 * A Unicode-only-space item name (`"\u2003"`) is non-nullish
 * (`("\u2003" ?? FALLBACK) === "\u2003"`), so the intentional
 * `waste.event.unknownItem` copy was bypassed and the UI could render a
 * blank-looking waste item label or interpolate blank padding into action
 * copy. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on padded item
 * names (`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`) would
 * invent a clean display item name if that gate Unicode-trimmed before
 * interpolation.
 *
 * Single-line item-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded item name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist); multiline free-text
 * note/body display stays on open #1013 / #1014 / #840.
 *
 * These are presentation **waste.event.unknownItem** itemName tokens only —
 * waste recent-event titles and waste/daily-report action-copy item
 * interpolations that share that fallback. Not Inventory detail Screen title
 * item_name (#1017), not Settings/Gmail `sender_email ??` (#candidate), not
 * Orders gmail `fallbackSender` (#candidate), not Orders detail Screen title
 * supplier_name (#1016), not Home StatusNotice approval title (#1011), not
 * setup.fallback.* (#1012), not activityEvents hard-coded English
 * `itemName ?? "Inventory"`, and not setupDrafts emptiness-only
 * `(record.itemName ?? "").trim()` matching. Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live
 * `|| t("waste.event.unknownItem")` branch owns the intentional localized
 * fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1017 / #1016 / #1015 / #1014 / #1013 / #1012 / #1011 on
 * other presentation soft-null tips without sharing those modules or
 * rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized waste itemName before it is rendered into
 * recent-event titles or action-copy interpolations.
 */
export function asciiTrimWasteItemName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a waste / daily-report itemName under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeWasteItemName(value: string): string | null {
  const trimmed = asciiTrimWasteItemName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one waste / daily-report itemName candidate.
 * Preserves soft empty → null (intentional localized waste.event.unknownItem
 * copy) while refusing to invent a clean item name via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live `|| t("waste.event.unknownItem")` branch owns the
 * fallback without inventing a clean item identity from padding, and without
 * letting non-nullish Unicode-only space or empty string bypass that fallback
 * through the prior `??` row.
 */
export function normalizeWasteItemName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed the intentional localized waste.event.unknownItem
  // copy via `??`. Do not invent a clean waste item label from padding.
  if (!value.trim()) return null;
  return canonicalizeWasteItemName(value);
}
