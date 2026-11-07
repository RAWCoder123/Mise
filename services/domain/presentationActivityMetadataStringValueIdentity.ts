/**
 * Activity expanded summarizeMetadata free-text string value helpers
 * (MISE-005YZ).
 *
 * Pins the Activity hub expanded metadata projection that previously always
 * passed raw string values for free-text identity keys into the Details line:
 * `${key}=${typeof value === "string" || typeof value === "number" ? value : "…"}`
 * for keys such as `itemName` and `supplierName` carried on activity event
 * metadata from `services/domain/activityEvents.ts` builders.
 *
 * A Unicode-only-space metadata string (`"\u2003"`) is non-nullish and still
 * rendered as `itemName= ` (or `supplierName= `) in the expanded Details
 * projection, so blank-looking identity copy appeared with no intentional
 * localized fallback. Empty string has the same blank-body bypass
 * (`itemName=`). Separately, Unicode `.trim()` on a padded free-text value
 * (`"\u2003Chicken Breast\u2003".trim() === "Chicken Breast"`) would invent a
 * clean display identity if that gate Unicode-trimmed before projecting into
 * the expanded metadata Details line.
 *
 * Single-line free-text identity tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality with
 * an unpadded item or supplier name. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist); multiline
 * free-text note/body display stays on open Activity evidence summary and
 * related tip stacks.
 *
 * These are presentation **activity.metadata.value.none** free-text metadata
 * string tokens only — the Activity expanded `summarizeMetadata` projection
 * for `itemName` / `supplierName` that falls through to that fallback when
 * soft-null. Not Activity expanded evidence.summary (#1155 / MISE-005YW), not
 * Activity hub row event.summary (#1150 / MISE-005YR), not Home ActivityRow
 * event.summary (#1151 / MISE-005YS), not Activity hub row event.title
 * (#1148 / MISE-005YP), not Home ActivityRow event.title (#1149 / MISE-005YQ),
 * and not machine metadata fields (`triggerType`, UUID references, numeric
 * quantities) which remain raw pass-through on this tip. Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * `|| t("activity.metadata.value.none")` branch owns the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #1155 / #1150 / #1151 / #1148 / #1149 without sharing those
 * modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity metadata free-text string value
 * before it is projected into the expanded Details line.
 */
export function asciiTrimActivityMetadataStringValue(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize one Activity expanded metadata free-text string value under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityMetadataStringValue(value: string): string | null {
  const trimmed = asciiTrimActivityMetadataStringValue(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Activity expanded metadata free-text string value
 * (`itemName` / `supplierName`). Preserves soft empty → null (intentional
 * localized activity.metadata.value.none copy) while refusing to invent a
 * clean identity via Unicode em-space / NBSP trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("activity.metadata.value.none")` branch owns the fallback without
 * inventing a clean Activity metadata identity from padding, and without
 * letting non-nullish Unicode-only space or empty string render a
 * blank-looking `itemName=` / `supplierName=` fragment through the prior
 * always-pass-string path.
 */
export function normalizeActivityMetadataStringValue(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered as the metadata Details fragment instead of the
  // intentional localized activity.metadata.value.none copy.
  // Do not invent a clean Activity metadata identity from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityMetadataStringValue(value);
}

/** Free-text identity keys projected by Activity expanded summarizeMetadata. */
export const ACTIVITY_METADATA_FREE_TEXT_KEYS = ["itemName", "supplierName"] as const;

export type ActivityMetadataFreeTextKey = (typeof ACTIVITY_METADATA_FREE_TEXT_KEYS)[number];

export function isActivityMetadataFreeTextKey(key: string): key is ActivityMetadataFreeTextKey {
  return (ACTIVITY_METADATA_FREE_TEXT_KEYS as readonly string[]).includes(key);
}
