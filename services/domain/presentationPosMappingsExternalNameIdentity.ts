/**
 * POS mappings card-header externalName identity helpers (MISE-005ABE).
 *
 * Pins POS mapping review card primary external catalog name chrome that
 * previously always passed free-form `mapping.externalName` into:
 *   <Text style={styles.mappingName}>{mapping.externalName}</Text>
 *
 * Repository parsing accepts any non-empty string via
 * `requiredPosMappingString(..., "externalName")` (length ≥ 1). A
 * Unicode-only-space external name (`"\u2003"`) therefore survives the
 * mapping queue parser and renders a blank-looking primary mapping title
 * with no intentional localized fallback. Empty string is already rejected
 * by the parser, but the presentation path still always-passed whatever
 * opaque free string arrived. Separately, Unicode `.trim()` on a padded
 * external name (`"\u2003Square Burger\u2003".trim() === "Square Burger"`)
 * would invent a clean display identity if that gate Unicode-trimmed before
 * rendering into the POS mappings card-header primary Text.
 *
 * Single-line external-name tips use ASCII end trim only and preserve NBSP
 * (no fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded external name. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **POS mappings card-header** `mapping.externalName`
 * tokens only — the primary mapping title under the location row. Soft empty
 * / Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("common.none")` branch owns the intentional localized fallback. Not
 * POS mappings card-header `mapping.locationName` (left raw on this tip), not
 * suggestedMenuItemName / selectedMenuItem.name (#1024 / MISE-005VP), not
 * choice-list `menuItem.name` (#1207 / MISE-005AAV), not choice-list
 * `menuItem.category` (#1206 / MISE-005AAU), not Square ingest
 * `SquareCatalogRow.external_name` (#947 / MISE-005TI), and not Insights
 * best-sellers itemName (#1196 / MISE-005AAK). Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1024 / #1207 / #1206 / #947 / #1196 without sharing those
 * modules or rewriting their call sites. #1024 / #1207 explicitly left the
 * card-header `externalName` / `locationName` pass-through alone. This tip
 * owns only the card-header primary external catalog name.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized POS mappings card-header external name
 * before it is rendered into the mapping title Text.
 */
export function asciiTrimPosMappingsExternalName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a POS mappings card-header external name under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePosMappingsExternalName(value: string): string | null {
  const trimmed = asciiTrimPosMappingsExternalName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for POS mappings card-header `mapping.externalName` display.
 * Preserves soft empty → null (intentional localized common.none copy) while
 * refusing to invent a clean external name via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null so
 * the live `|| t("common.none")` branch owns the fallback without inventing a
 * clean POS mappings card-header external identity from padding, and without
 * letting non-nullish Unicode-only space render a blank-looking title through
 * the prior always-pass mapping-name chrome.
 */
export function normalizePosMappingsExternalName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into the card-header primary line as a
  // blank-looking external catalog identity.
  // Do not invent a clean POS mappings card-header external name from padding.
  if (!value.trim()) return null;
  return canonicalizePosMappingsExternalName(value);
}
