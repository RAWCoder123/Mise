/**
 * Activity hub triggerReference identity helpers (MISE-005AAL).
 *
 * Pins the Activity expanded-detail free-form `event.triggerReference`
 * interpolation that previously always passed raw `event.triggerReference`
 * into the trigger detail line whenever the reference was truthy:
 * `{event.triggerReference ? ` · ${event.triggerReference}` : ""}`.
 *
 * A Unicode-only-space trigger reference (`"\u2003"`) is non-nullish and
 * truthy as an activity-event field, so Activity still rendered
 * blank-looking correlation identity after the trigger type
 * (`"Trigger: schedule ·  "`). Empty string already omitted via the falsy
 * branch. Separately, Unicode `.trim()` on a padded reference
 * (`"\u2003rec_7f3a2b1c\u2003".trim() === "rec_7f3a2b1c"`) would invent a
 * clean display correlation identity if that gate Unicode-trimmed before
 * interpolating into Activity trigger detail copy.
 *
 * Single-line correlation-ref tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would still
 * strip end padding (NBSP / em-space) so padding cannot invent equality
 * with an unpadded reference. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity triggerReference** tokens only — the
 * expanded-detail suffix `event.triggerReference` that soft-nulls back to
 * the prior omit-reference falsy branch (`""` after trigger type) when
 * unsafe. Not Activity relatedEntityId display (still open), not Activity
 * event.category display, not activity_events.trigger_reference cntrl CHECK
 * (#571 / MISE-005FG), not activity_events.related_entity_id cntrl CHECK
 * (#573 / MISE-005FI), not activity_events.trigger_type cntrl CHECK
 * (#568 / MISE-005FD), not mise_actions.trigger_reference cntrl CHECK
 * (#576 / MISE-005FL), not Activity title/summary i18n (#271), and not
 * Activity hub category/status/trigger label i18n (#239). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * omit-reference branch owns the intentional trigger-type-only fallback.
 * Ordinary ASCII whitespace still trims clean.
 *
 * Complements open #571 / #573 / #568 / #576 / #271 / #239 without sharing
 * those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity triggerReference before it is
 * rendered into trigger detail copy.
 */
export function asciiTrimActivityTriggerReference(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity triggerReference under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityTriggerReference(
  value: string
): string | null {
  const trimmed = asciiTrimActivityTriggerReference(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub `event.triggerReference` display.
 * Preserves soft empty → null (intentional omit-reference fallthrough) while
 * refusing to invent a clean correlation ref via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens return
 * null so the live omit-reference branch owns the fallback without inventing
 * a clean Activity triggerReference from padding, and without letting
 * non-nullish Unicode-only space render a blank-looking correlation identity
 * through the prior always-pass truthy trigger-detail suffix path.
 */
export function normalizeActivityTriggerReference(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Activity trigger detail copy as a
  // blank-looking correlation identity.
  // Do not invent a clean Activity triggerReference from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityTriggerReference(value);
}
