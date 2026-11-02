/**
 * Draft-order supplier_name identity helpers (MISE-005VZ).
 *
 * Pins miseDomain `buildDraftsFromRecommendations` supplier display that
 * previously selected the draft `supplier_name` / order-message greeting with
 * a raw nullish-coalescing gate:
 *
 * ```ts
 * const supplierName = items[0]?.supplier_name ?? "Supplier";
 * ```
 *
 * A Unicode-only-space supplier_name (`"\u2003"`) is non-nullish under `??`,
 * so draft orders stored the padding (or bypassed the intentional hard-coded
 * `"Supplier"` empty-state) instead of failing closed. Empty string has the
 * same `??` bypass (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()`
 * on a padded supplier (`"\u2003Harbor Produce\u2003".trim() === "Harbor Produce"`)
 * would invent a clean supplier display identity before it is written into
 * draft `supplier_name` and `buildSupplierOrderMessage`.
 *
 * Single-line supplier tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip end
 * padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded supplier name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are miseDomain **draft-order supplier_name** tokens only — the
 * `buildDraftsFromRecommendations` path that falls through to `"Supplier"`.
 * Not Orders detail title supplier_name (#1016 / MISE-005VH), not
 * orderAutomation supplierName (#833 / MISE-005OY), not
 * supplierReliability supplierName (#834 / MISE-005OZ), not demo supplier
 * display-name (#914 / MISE-005SB), not Settings suppliers recipient-email
 * (#1032 / MISE-005VX), not supplier operator_note (#840 / MISE-005PF), and
 * not SQL supplier_name cntrl pins (#612 / #610 / #589). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live `"Supplier"`
 * branch owns the intentional empty state. Ordinary ASCII whitespace still
 * trims clean.
 *
 * Complements open #1032 / #1016 / #914 / #840 / #834 / #833 / #612 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized draft-order supplier name before it is
 * written into supplier drafts / order messages.
 */
export function asciiTrimDraftOrderSupplierName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a draft-order supplier_name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDraftOrderSupplierName(value: string): string | null {
  const trimmed = asciiTrimDraftOrderSupplierName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one draft-order supplier_name candidate.
 * Preserves soft empty → null (intentional hard-coded `"Supplier"` copy)
 * while refusing to invent a clean supplier via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `"Supplier"` branch owns the fallback without inventing a clean
 * supplier from padding, and without letting non-nullish Unicode-only space
 * or empty string bypass `"Supplier"` through the prior `??` row.
 */
export function normalizeDraftOrderSupplierName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed `"Supplier"` via `??`. Do not invent a clean
  // draft-order supplier name from padding.
  if (!value.trim()) return null;
  return canonicalizeDraftOrderSupplierName(value);
}
