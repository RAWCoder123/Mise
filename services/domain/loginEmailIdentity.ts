/**
 * Login-screen mailbox identity helpers (MISE-005QP).
 *
 * Pins `app/(auth)/login.tsx` email continue / sign-in / chip prep outside the
 * React Native screen graph so Node tests can exercise inventing proofs without
 * loading Expo. The prior path Unicode-trimmed the operator email before
 * emptiness checks and `signInWithPassword`
 * (`'\u2003chef@restaurant.com\u2003'.trim() === 'chef@restaurant.com'`), so
 * NBSP / em-space padding invented equality with the clean Auth mailbox.
 *
 * These are single-line login mailbox tokens used only for the hosted
 * email/password admission UI, not free-form multiline prose and not the
 * accountAuth signup validation path. Only ASCII end trim is pinned; case and
 * accents are left unchanged so this tip stays narrow relative to open
 * accountAuth mailbox tip #722 / MISE-005KS (which also folds ASCII A–Z and
 * validates mailbox shape). Soft empty (ASCII whitespace or Unicode-only space)
 * and Unicode-padded non-empty tokens soft to `""` so callers keep the prior
 * `login.error.emailRequired` contract rather than inventing a clean sign-in
 * identity.
 *
 * Complements open accountAuth mailbox tip #722 / MISE-005KS, team-member
 * invite email tip #674, beta provisioning email tip #707, outreach email tip
 * #420, and supplier-recipient email tip #681 without sharing those modules or
 * rewriting `validateSignUpInput` / `isValidAccountEmail` on this path.
 */

/**
 * ASCII-only end trim; Unicode `trim()` would strip NBSP / em-space
 * padding and invent a normalized login mailbox before Auth sign-in.
 */
export function asciiTrimLoginEmail(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a login mailbox under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeLoginEmail(value: string): string | null {
  const trimmed = asciiTrimLoginEmail(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for login continue / sign-in / chip display.
 * Preserves soft empty → `login.error.emailRequired` (prior `.trim()`
 * emptiness) while refusing to invent a clean mailbox via Unicode em-space /
 * NBSP trim. Non-string, control-bearing, and Unicode-padded tokens soft to
 * `""`. Does not add mailbox-shape or ASCII case-fold rules owned by #722.
 */
export function normalizeLoginEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value === "") return "";
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the email-required branch.
  if (!value.trim()) return "";
  return canonicalizeLoginEmail(value) ?? "";
}
