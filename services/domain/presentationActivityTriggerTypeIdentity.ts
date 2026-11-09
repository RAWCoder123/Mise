/**
 * Activity hub triggerType identity helpers (MISE-005AAP).
 *
 * Pins the Activity expanded-detail free-form `event.triggerType`
 * interpolation that previously always passed raw `event.triggerType`
 * into the trigger detail line with no prep gate:
 * `{t("activity.detail.trigger")}: {event.triggerType}`.
 *
 * A Unicode-only-space trigger type (`"\u2003"`) is a non-empty string, so
 * Activity still rendered blank-looking trigger identity
 * (`"Trigger:  "`). Empty string already rendered as an empty type token.
 * Separately, Unicode `.trim()` on a padded type
 * (`"\u2003pos_sync\u2003".trim() === "pos_sync"`) would invent a clean
 * display trigger identity if that gate Unicode-trimmed before
 * interpolating into Activity trigger detail copy — including through
 * open Activity hub label i18n (#239) `humanizeActivityToken`, which
 * Unicode-trims unknown free-form triggers before underscore→space
 * humanize.
 *
 * Single-line trigger-type tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent
 * equality with an unpadded type. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity triggerType** tokens only — the
 * expanded-detail `event.triggerType` that soft-nulls back to the prior
 * empty-type display (`""` after the Trigger label) when unsafe. Not
 * Activity triggerReference display (#1197 / MISE-005AAL), not Activity
 * relatedEntityType display (#1200 / MISE-005AAO), not Activity
 * relatedEntityId display (#1198 / MISE-005AAM), not Activity actionId
 * display (#1199 / MISE-005AAN), not Activity event.category /
 * event.status display, not activity_events.trigger_type cntrl CHECK
 * tip (#568 / MISE-005FD), not mise_actions.trigger_type cntrl CHECK
 * (#577 / MISE-005FM), not Activity title/summary i18n (#271), and not
 * Activity hub category/status/trigger label i18n (#239). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * empty-type fallthrough owns the intentional blank-type fallback
 * without inventing a clean Activity triggerType from padding, and
 * without letting Unicode-only space render blank-looking trigger
 * identity through the prior always-pass path. Ordinary ASCII
 * whitespace still trims clean.
 *
 * Complements open #1197 / #1200 / #1198 / #1199 / #568 / #577 / #271 /
 * #239 without sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity triggerType before it is
 * rendered into trigger detail copy.
 */
export function asciiTrimActivityTriggerType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity triggerType under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityTriggerType(value: string): string | null {
  const trimmed = asciiTrimActivityTriggerType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub `event.triggerType` display.
 * Preserves soft empty → null (intentional empty-type fallthrough) while
 * refusing to invent a clean trigger type via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live empty-type branch owns the fallback without
 * inventing a clean Activity triggerType from padding, and without
 * letting Unicode-only space render a blank-looking trigger identity
 * through the prior always-pass trigger detail path.
 */
export function normalizeActivityTriggerType(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered into Activity trigger detail copy as a
  // blank-looking trigger identity.
  // Do not invent a clean Activity triggerType from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityTriggerType(value);
}
