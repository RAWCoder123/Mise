/**
 * Autonomy-settings communicationType identity helpers (MISE-005QQ).
 *
 * Pins `app/settings/autonomy.tsx` draft communication-channel prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs without
 * loading Expo. The prior path Unicode-trimmed the draft before save
 * (`'\u2003email\u2003'.trim() === 'email'`), so NBSP / em-space padding invented
 * equality with the clean channel label that open SQL tip #614 /
 * MISE-005GX (`communication_type collate "C"`) would not treat as identical
 * when padding remained.
 *
 * These are single-line autonomy channel labels used only for the
 * owner/admin Autonomy Settings save path, not free-form multiline prose and
 * not the autonomy restaurant-workspace tip (#741 / MISE-005LK). Soft empty
 * (ASCII whitespace or Unicode-only space) and Unicode-padded non-empty tokens
 * soft to `null` so callers keep the prior `.trim() || null` contract rather
 * than inventing a clean channel identity. Ordinary ASCII whitespace still
 * trims clean. Length is capped at 80 to stay aligned with the hosted CHECK.
 *
 * Complements open SQL communication_type tip #614 / MISE-005GX and autonomy
 * restaurant tip #741 / MISE-005LK without rewriting those modules or the
 * allowed-window / spend-limit draft paths on this screen.
 */

export const AUTONOMY_COMMUNICATION_TYPE_MAX_CHARACTERS = 80;

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized autonomy communication channel before save.
 */
export function asciiTrimAutonomyCommunicationType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an autonomy communication channel under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, control-
 * bearing, or longer than the hosted 80-character bound.
 */
export function canonicalizeAutonomyCommunicationType(value: string): string | null {
  const trimmed = asciiTrimAutonomyCommunicationType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (trimmed.length > AUTONOMY_COMMUNICATION_TYPE_MAX_CHARACTERS) return null;
  return trimmed;
}

/**
 * Soft normalize for Autonomy Settings save.
 * Preserves soft empty → `null` (prior `.trim() || null`) while refusing to
 * invent a clean channel via Unicode em-space / NBSP trim. Non-string,
 * control-bearing, over-long, and Unicode-padded tokens soft to `null`.
 */
export function normalizeAutonomyCommunicationType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the null channel branch.
  if (!value.trim()) return null;
  return canonicalizeAutonomyCommunicationType(value);
}
