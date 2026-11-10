/**
 * POS mappings card-meta externalVariationId identity helpers (MISE-005ABJ).
 *
 * Pins POS mapping review card meta variation chrome that previously always
 * passed free-form `mapping.externalVariationId` into:
 *   t("pos.mappings.variation", { value: mapping.externalVariationId })
 *
 * Repository parsing accepts any non-empty string via
 * `requiredPosMappingString(..., "externalVariationId")` (length ≥ 1). A
 * Unicode-only-space variation id (`"\u2003"`) therefore survives the mapping
 * queue parser and interpolates into blank-looking "Square variation  "
 * chrome with no intentional localized fallback. Empty string is already
 * rejected by the parser, but the presentation path still always-passed
 * whatever opaque free string arrived. Separately, Unicode `.trim()` on a
 * padded variation id (`"\u2003VAR-A\u2003".trim() === "VAR-A"`) would invent
 * a clean display identity if that gate Unicode-trimmed before interpolating
 * into the POS mappings card-meta variation line.
 *
 * Single-line variation-id tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded variation id. Accents and case are preserved. Full C0/DEL control
 * rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings card-meta** `mapping.externalVariationId`
 * tokens only — the meta line under the external catalog name. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `pos.mappings.variation.none` branch owns the intentional localized
 * fallback. Not POS mappings card-header `mapping.locationName` (#1217 /
 * MISE-005ABF), not card-header `mapping.externalName` (#1216 / MISE-005ABE),
 * not suggestedMenuItemName / selectedMenuItem.name (#1024 / MISE-005VP), not
 * choice-list `menuItem.name` (#1207 / MISE-005AAV), not choice-list
 * `menuItem.category` (#1206 / MISE-005AAU), and not Square catalog ingest
 * `external_variation_id` persistence. Ordinary ASCII whitespace still trims
 * clean.
 *
 * Complements open #1217 / #1216 / #1024 / #1207 / #1206 without sharing those
 * modules or rewriting their call sites. #1216 / #1217 explicitly left the
 * card-meta `externalVariationId` interpolate alone. This tip owns only the
 * card-meta variation id interpolate.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings card-meta variation id before
 * it is interpolated into the variation meta line.
 */
export function asciiTrimPosMappingsExternalVariationId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings card-meta external variation id under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsExternalVariationId(value: string): string | null {
  const trimmed = asciiTrimPosMappingsExternalVariationId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings card-meta `mapping.externalVariationId`
 * display. Preserves soft empty → null (intentional localized
 * `pos.mappings.variation.none` copy) while refusing to invent a clean
 * variation id via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live none
 * branch owns the fallback without inventing a clean POS mappings card-meta
 * variation identity from padding, and without letting non-nullish
 * Unicode-only space render a blank-looking "Square variation  " line through
 * the prior always-pass variation interpolate.
 */
export function normalizePosMappingsExternalVariationId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still interpolated into the card-meta variation line as a
  // blank-looking variation identity.
  // Do not invent a clean POS mappings card-meta variation id from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsExternalVariationId(value);
}
