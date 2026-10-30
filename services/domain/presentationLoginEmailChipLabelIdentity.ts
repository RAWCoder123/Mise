/**
 * Login email chip label identity helpers (MISE-005UG).
 *
 * Pins Login password-step `email.trim()` chip prep outside the Expo UI
 * graph so Node tests can exercise inventing proofs without loading React
 * Native. Prior Login chrome Unicode-trimmed the typed email before
 * rendering the editable email chip
 * (`'\u2003chef@example.com\u2003'.trim() === 'chef@example.com'`), so
 * NBSP/em-space padding invented a clean login-email identity rendered into
 * the password-step chip.
 *
 * These are presentation **Login email chip labels** only — not Settings
 * account email labels (#966 / MISE-005UB), not outreach-webhook From
 * mailbox prep (#959 / MISE-005TU), not domain `normalizeOutreachEmail`
 * (#420), not `normalizeTeamMemberEmail` invite / candidate email identity
 * (#674 / #435), not More / Settings profile name labels (#964 /
 * MISE-005TZ), not Team Settings directory member name/email labels (#965 /
 * MISE-005UA), not Create Task assignee chip labels (#963 / MISE-005TY),
 * not Home / Ask Mise greeting first-name tokens (#961 / MISE-005TW), not
 * outreach greeting `firstName` (#960 / MISE-005TV), not user profile
 * display-name persistence (#849 / MISE-005PO), and not auth continue /
 * sign-in emptiness gates that still use `email.trim()` for credential
 * submission. Soft empty / Unicode-padded / control-bearing tokens soft-null
 * so padded login emails cannot invent a clean chip label; the live call
 * site may fall back to the raw typed seed without inventing a clean
 * identity from padding. Ordinary ASCII whitespace still trims clean. Case
 * and accents are left unchanged.
 *
 * Complements open Settings account email tip #966 / MISE-005UB without
 * sharing that module or rewriting auth continue / sign-in / outreach /
 * Settings / Team / Create Task paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized login email chip label before it is
 * rendered into the password-step chip.
 */
export function asciiTrimPresentationLoginEmailChipLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Login email chip label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationLoginEmailChipLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationLoginEmailChipLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize the typed email for Login password-step chip display.
 * Preserves soft empty → null (prior `.trim()` emptiness) while refusing to
 * invent a clean email via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live call
 * site can fall back to the raw typed seed without inventing a clean
 * login-email identity from padding.
 */
export function normalizePresentationLoginEmailChipLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those. Do not invent a login email chip label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationLoginEmailChipLabel(value);
}

/**
 * Resolve Login email chip label under ASCII C. Soft-null / empty leaves
 * the call site to fall back without inventing clean chrome.
 */
export function presentationLoginEmailChipLabel(
  email: string | null | undefined
): string | null {
  return normalizePresentationLoginEmailChipLabel(email);
}
