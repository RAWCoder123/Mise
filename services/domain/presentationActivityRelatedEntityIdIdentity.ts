/**
 * Activity hub relatedEntityId identity helpers (MISE-005AAM).
 *
 * Pins the Activity expanded-detail free-form `event.relatedEntityId`
 * interpolation that previously always passed raw `event.relatedEntityId`
 * into the related-entity detail line whenever the id was truthy:
 * `{event.relatedEntityId ? ` · ${event.relatedEntityId}` : ""}`.
 *
 * A Unicode-only-space related-entity id (`"\u2003"`) is non-nullish and
 * truthy as an activity-event field, so Activity still rendered
 * blank-looking related-entity identity after the related-entity type
 * (`"Related: inventory_item ·  "`). Empty string already omitted via the
 * falsy branch. Separately, Unicode `.trim()` on a padded id
 * (`"\u2003inv_9c4e1a02\u2003".trim() === "inv_9c4e1a02"`) would invent a
 * clean display related-entity identity if that gate Unicode-trimmed
 * before interpolating into Activity related-entity detail copy.
 *
 * Single-line related-entity-id tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded id. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity relatedEntityId** tokens only — the
 * expanded-detail suffix `event.relatedEntityId` that soft-nulls back to
 * the prior omit-id falsy branch (`""` after related-entity type) when
 * unsafe. Not Activity triggerReference display (#1197 / MISE-005AAL), not
 * Activity event.category display, not activity_events.related_entity_id
 * cntrl CHECK (#573 / MISE-005FI), not activity_events.related_entity_type
 * cntrl CHECK (#572 / MISE-005FH), not activity_events.trigger_reference
 * cntrl CHECK (#571 / MISE-005FG), not Activity title/summary i18n (#271),
 * and not Activity hub category/status/trigger label i18n (#239). Soft
 * empty / Unicode-padded / control-bearing tokens soft-null so the live
 * omit-id branch owns the intentional related-entity-type-only fallback.
 * Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #573 / #572 / #571 / #1197 / #271 / #239 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity relatedEntityId before it is
 * rendered into related-entity detail copy.
 */
export function asciiTrimActivityRelatedEntityId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity relatedEntityId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityRelatedEntityId(
  value: string
): string | null {
  const trimmed = asciiTrimActivityRelatedEntityId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub `event.relatedEntityId` display.
 * Preserves soft empty → null (intentional omit-id fallthrough) while
 * refusing to invent a clean related-entity id via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live omit-id branch owns the fallback without inventing a
 * clean Activity relatedEntityId from padding, and without letting
 * non-nullish Unicode-only space render a blank-looking related-entity
 * identity through the prior always-pass truthy related-entity detail
 * suffix path.
 */
export function normalizeActivityRelatedEntityId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Activity related-entity detail copy as a
  // blank-looking related-entity identity.
  // Do not invent a clean Activity relatedEntityId from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityRelatedEntityId(value);
}
