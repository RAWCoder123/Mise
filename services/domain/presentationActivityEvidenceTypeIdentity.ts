/**
 * Activity hub expanded evidence.type identity helpers (MISE-005ABN).
 *
 * Pins the Activity expanded evidence-line free-form `evidence.type`
 * interpolation that previously always passed raw `evidence.type` into
 * the evidence line with only underscore→space humanize and no prep
 * gate:
 * `{evidence.type.replace(/_/g, " ")} — {evidence.summary}`.
 *
 * A Unicode-only-space evidence type (`"\u2003"`) is a non-empty string,
 * so Activity still rendered blank-looking evidence type identity
 * (`"  — …"`). Empty string already rendered as an empty type token
 * before the em-dash. Separately, Unicode `.trim()` on a padded type
 * (`"\u2003inventory_item\u2003".trim() === "inventory_item"`) would
 * invent a clean display evidence type if that gate Unicode-trimmed
 * before interpolating into Activity evidence-line copy (and before
 * underscore→space humanize).
 *
 * Single-line evidence-type tips use ASCII end trim only and preserve
 * NBSP (no fold into plain space). Soft-null when Unicode trim would
 * still strip end padding (NBSP / em-space) so padding cannot invent
 * equality with an unpadded type. Accents and case are preserved. Full
 * C0/DEL control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are presentation **Activity evidence.type** tokens only — the
 * expanded evidence-line `evidence.type` that soft-nulls back to the
 * prior empty-type display (`""` before the em-dash) when unsafe. Not
 * Activity expanded evidence.summary display (#1155 / MISE-005YW), not
 * Activity relatedEntityType display (#1200 / MISE-005AAO), not
 * Activity triggerType display (#1201 / MISE-005AAP), not Activity
 * relatedEntityId / actionId / triggerReference display
 * (#1198 / #1199 / #1197), not Autonomy actionType / evidence.type
 * leave-alone (#254 / #239 / #273), not restaurant-tasks evidence type
 * (#856 / MISE-005PV), not finding-decision evidence type (#793 /
 * MISE-005NK), not Activity title/summary i18n (#271), and not Activity
 * hub category/status/trigger label i18n (#239). Soft empty /
 * Unicode-padded / control-bearing tokens soft-null so the live
 * empty-type fallthrough owns the intentional blank-type fallback
 * without inventing a clean Activity evidence.type from padding, and
 * without letting Unicode-only space render blank-looking evidence
 * type identity through the prior always-pass path. Ordinary ASCII
 * whitespace still trims clean. Underscore→space humanize remains a
 * post-normalize presentation step on the safe token only.
 *
 * Complements open #1155 / #1200 / #1201 / #1197–#1199 / #856 / #793 /
 * #271 / #239 without sharing those modules or rewriting their call
 * sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized Activity evidence.type before it is
 * rendered into expanded evidence-line copy.
 */
export function asciiTrimActivityEvidenceType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Activity evidence.type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeActivityEvidenceType(value: string): string | null {
  const trimmed = asciiTrimActivityEvidenceType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Activity hub expanded `evidence.type` display.
 * Preserves soft empty → null (intentional empty-type fallthrough) while
 * refusing to invent a clean evidence type via Unicode em-space / NBSP
 * trim. Does not throw; Unicode-padded / unsafe / non-string tokens
 * return null so the live empty-type branch owns the fallback without
 * inventing a clean Activity evidence.type from padding, and without
 * letting Unicode-only space render blank-looking evidence type
 * identity through the prior always-pass evidence-line path.
 */
export function normalizeActivityEvidenceType(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-empty padding
  // previously still rendered into Activity evidence-line copy as a
  // blank-looking evidence type identity.
  // Do not invent a clean Activity evidence.type from padding.
  if (!value.trim()) return null;
  return canonicalizeActivityEvidenceType(value);
}
