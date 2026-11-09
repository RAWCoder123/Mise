/**
 * POS mappings card-header locationName identity helpers (MISE-005ABF).
 *
 * Pins POS mapping review card location row chrome that previously always
 * passed free-form `mapping.locationName` into:
 *   <Text style={styles.location}>{mapping.locationName}</Text>
 *
 * Repository parsing accepts any non-empty string via
 * `requiredPosMappingString(..., "locationName")` (length ≥ 1). A
 * Unicode-only-space location name (`"\u2003"`) therefore survives the
 * mapping queue parser and renders a blank-looking location row with no
 * intentional localized fallback. Empty string is already rejected by the
 * parser, but the presentation path still always-passed whatever opaque free
 * string arrived. Separately, Unicode `.trim()` on a padded location name
 * (`"\u2003Main Counter\u2003".trim() === "Main Counter"`) would invent a
 * clean display identity if that gate Unicode-trimmed before rendering into
 * the POS mappings card-header location Text.
 *
 * Single-line location-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded location name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings card-header** `mapping.locationName`
 * tokens only — the location row above the primary mapping title. Soft empty
 * / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("common.none")` branch owns the intentional localized fallback. Not
 * POS mappings card-header `mapping.externalName` (left raw on this tip;
 * owned by #1216 / MISE-005ABE), not suggestedMenuItemName /
 * selectedMenuItem.name (#1024 / MISE-005VP), not choice-list
 * `menuItem.name` (#1207 / MISE-005AAV), not choice-list `menuItem.category`
 * (#1206 / MISE-005AAU), and not Square ingest
 * `SquareCatalogRow.external_name` (#947 / MISE-005TI). Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #1216 / #1024 / #1207 / #1206 / #947 without sharing those
 * modules or rewriting their call sites. #1216 explicitly left the
 * card-header `locationName` pass-through alone. This tip owns only the
 * card-header location row name.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings card-header location name
 * before it is rendered into the location Text.
 */
export function asciiTrimPosMappingsLocationName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings card-header location name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsLocationName(value: string): string | null {
  const trimmed = asciiTrimPosMappingsLocationName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings card-header `mapping.locationName` display.
 * Preserves soft empty → null (intentional localized common.none copy) while
 * refusing to invent a clean location name via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("common.none")` branch owns the fallback without inventing a
 * clean POS mappings card-header location identity from padding, and without
 * letting non-nullish Unicode-only space render a blank-looking location row
 * through the prior always-pass location chrome.
 */
export function normalizePosMappingsLocationName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the card-header location line as a
  // blank-looking POS location identity.
  // Do not invent a clean POS mappings card-header location name from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsLocationName(value);
}
