/**
 * Activity hub actionId identity helpers (MISE-005AAN).
 *
 * Pins the Activity expanded-detail free-form `event.actionId`
 * interpolation that previously always passed raw `event.actionId`
 * into the action detail line whenever the id was truthy:
 * `{event.actionId ? (… {event.actionId} …) : null}`.
 *
 * A Unicode-only-space action id (`"\u2003"`) is non-nullish and
 * truthy as an activity-event field, so Activity still rendered
 * blank-looking action identity (`"Action:  "`). Empty string already
 * omitted via the falsy branch. Separately, Unicode `.trim()` on a
 * padded id (`"\u2003act_8e2b4f71\u2003".trim() === "act_8e2b4f71"`)
 * would invent a clean display action identity if that gate
 * Unicode-trimmed before interpolating into Activity action detail
 * copy.
 *
 * Single-line action-id tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent
 * equality with an unpadded id. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity actionId** tokens only — the
 * expanded-detail `event.actionId` that soft-nulls back to the prior
 * omit-action falsy branch (`null` / no action detail line) when
 * unsafe. Not Activity relatedEntityId display (#1198 / MISE-005AAM),
 * not Activity triggerReference display (#1197 / MISE-005AAL), not
 * Activity event.category display, not Activity triggerType display,
 * not Mise-actions orderId/actionId tips (#761 / #772), not Activity
 * title/summary i18n (#271), and not Activity hub category/status/
 * trigger label i18n (#239). Soft empty / Unicode-padded /
 * control-bearing tokens soft-null so the live omit-action branch owns
 * the intentional no-action-detail fallback. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1198 / #1197 / #761 / #772 / #271 / #239 without
 * sharing those modules or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity actionId before it is
 * rendered into action detail copy.
 */
export function asciiTrimActivityActionId(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity actionId under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityActionId(value: string): string | null {
  const trimmed = asciiTrimActivityActionId(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub `event.actionId` display.
 * Preserves soft empty → null (intentional omit-action fallthrough) while
 * refusing to invent a clean action id via Unicode em-space / NBSP trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null
 * so the live omit-action branch owns the fallback without inventing a
 * clean Activity actionId from padding, and without letting non-nullish
 * Unicode-only space render a blank-looking action identity through the
 * prior always-pass truthy action detail path.
 */
export function normalizeActivityActionId(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously still rendered into Activity action detail copy as a
  // blank-looking action identity.
  // Do not invent a clean Activity actionId from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityActionId(value);
}
