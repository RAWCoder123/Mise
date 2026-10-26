/**
 * Autonomy-settings allowed-window time identity helpers (MISE-005QR).
 *
 * Pins `app/settings/autonomy.tsx` draft allowedStartTime / allowedEndTime prep
 * outside the React Native screen graph so Node tests can exercise inventing
 * proofs without loading Expo. The prior `normalizeTime` path Unicode-trimmed
 * the draft before the HH:MM(:SS) gate
 * (`'\u200309:00\u2003'.trim() === '09:00'` → `'09:00:00'`), so NBSP / em-space
 * padding invented equality with the clean allowed-window time that a
 * Postgres `time` / ASCII C comparison would not treat as identical when
 * padding remained.
 *
 * These are single-line autonomy allowed-window clock strings used only for
 * the owner/admin Autonomy Settings save path, not free-form multiline prose,
 * not the autonomy restaurant-workspace tip (#741 / MISE-005LK), and not the
 * communication-channel tip (#877 / MISE-005QQ). Soft empty (ASCII whitespace
 * or Unicode-only space) and Unicode-padded non-empty tokens soft to `null`
 * so callers keep the prior `normalizeTime` emptiness contract rather than
 * inventing a clean clock identity. Ordinary ASCII whitespace still trims
 * clean. Valid `HH:MM` values still expand to `HH:MM:00`.
 *
 * Complements open autonomy restaurant tip #741 / MISE-005LK and open
 * communicationType tip #877 / MISE-005QQ without rewriting those modules or
 * the spend-limit draft path on this screen.
 */

const ALLOWED_TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized autonomy allowed-window time before save.
 */
export function asciiTrimAutonomyAllowedTime(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an autonomy allowed-window clock under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, control-
 * bearing, or not matching `HH:MM` / `HH:MM:SS`. Expands five-character
 * `HH:MM` values to `HH:MM:00` to preserve the prior normalizeTime contract.
 */
export function canonicalizeAutonomyAllowedTime(value: string): string | null {
  const trimmed = asciiTrimAutonomyAllowedTime(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  if (!ALLOWED_TIME_PATTERN.test(trimmed)) return null;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

/**
 * Soft normalize for Autonomy Settings allowed-window save.
 * Preserves soft empty → `null` (prior `normalizeTime` emptiness) while
 * refusing to invent a clean clock via Unicode em-space / NBSP trim.
 * Non-string, control-bearing, malformed, and Unicode-padded tokens soft to
 * `null`.
 */
export function normalizeAutonomyAllowedTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the null allowed-window branch.
  if (!value.trim()) return null;
  return canonicalizeAutonomyAllowedTime(value);
}
