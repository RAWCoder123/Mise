/**
 * Activity hub relatedEntityType identity helpers (MISE-005AAO).
 *
 * Pins the Activity expanded-detail free-form `event.relatedEntityType`
 * interpolation that previously always passed raw
 * `event.relatedEntityType` into the related detail line whenever the
 * type was truthy:
 * `{event.relatedEntityType ? (… {event.relatedEntityType.replace(/_/g, " ")} …) : null}`.
 *
 * A Unicode-only-space related-entity type (`"\u2003"`) is non-nullish and
 * truthy as an activity-event field, so Activity still rendered
 * blank-looking related identity (`"Related:  "`). Empty string already
 * omitted via the falsy branch. Separately, Unicode `.trim()` on a
 * padded type (`"\u2003purchase_order\u2003".trim() === "purchase_order"`)
 * would invent a clean display related-entity type if that gate
 * Unicode-trimmed before interpolating into Activity related detail
 * copy (and before underscore→space humanize).
 *
 * Single-line related-entity-type tips use ASCII end trim only and
 * preserve NBSP (no fold into plain space). Soft-null when Unicode trim
 * would still strip end padding (NBSP / em-space) so padding cannot
 * invent equality with an unpadded type. Accents and case are
 * preserved. Full C0/DEL control rejection applies (no LF/TAB/CR
 * allowlist).
 *
 * These are presentation **Activity relatedEntityType** tokens only —
 * the expanded-detail `event.relatedEntityType` that soft-nulls back to
 * the prior omit-related falsy branch (`null` / no related detail line)
 * when unsafe. Not Activity relatedEntityId display (#1198 /
 * MISE-005AAM), not Activity actionId display (#1199 / MISE-005AAN), not
 * Activity triggerReference display (#1197 / MISE-005AAL), not Activity
 * event.category display, not Activity triggerType display, not
 * activity_events.related_entity_type cntrl CHECK tip (#572 /
 * MISE-005FH), not Activity title/summary i18n (#271), and not Activity
 * hub category/status/trigger label i18n (#239). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * omit-related branch owns the intentional no-related-detail fallback.
 * Ordinary ASCII whitespace still trims clean. Underscore→space
 * humanize remains a post-normalize presentation step on the safe
 * token only.
 *
 * Complements open #1199 / #1198 / #1197 / #572 / #271 / #239 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity relatedEntityType before it is
 * rendered into related detail copy.
 */
export function asciiTrimActivityRelatedEntityType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity relatedEntityType under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityRelatedEntityType(value: string): string | null {
  const trimmed = asciiTrimActivityRelatedEntityType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub `event.relatedEntityType` display.
 * Preserves soft empty → null (intentional omit-related fallthrough) while
 * refusing to invent a clean related-entity type via Unicode em-space /
 * NBSP trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live omit-related branch owns the fallback without
 * inventing a clean Activity relatedEntityType from padding, and without
 * letting non-nullish Unicode-only space render a blank-looking related
 * identity through the prior always-pass truthy related detail path.
 */
export function normalizeActivityRelatedEntityType(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Activity related detail copy as a
  // blank-looking related identity.
  // Do not invent a clean Activity relatedEntityType from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityRelatedEntityType(value);
}
