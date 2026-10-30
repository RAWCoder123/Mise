/**
 * Settings account email label identity helpers (MISE-005UB).
 *
 * Pins Settings `user?.email?.trim() || t("settings.account.emailMissing")`
 * prep outside the Expo UI graph so Node tests can exercise inventing
 * proofs without loading React Native. Prior Settings account chrome
 * Unicode-trimmed the signed-in account email before rendering the email
 * subtitle (`'\u2003chef@example.com\u2003'.trim() === 'chef@example.com'`),
 * so NBSP/em-space padding invented a clean account-email identity
 * rendered into Settings account chrome. Soft empty / Unicode-only space
 * also collapsed through `.trim()` into the intentional i18n email-missing
 * fallback.
 *
 * These are presentation **Settings account email labels** only — not
 * More / Settings profile name labels (#964 / MISE-005TZ), not More /
 * Settings profile avatar initials (#962 / MISE-005TX), not Team Settings
 * directory member name/email labels (#965 / MISE-005UA), not Create Task
 * assignee chip labels (#963 / MISE-005TY), not Home / Ask Mise greeting
 * first-name tokens (#961 / MISE-005TW), not outreach greeting `firstName`
 * (#960 / MISE-005TV), not outreach-webhook From mailbox prep (#959 /
 * MISE-005TU), not domain `normalizeOutreachEmail` (#420), not user
 * profile display-name persistence (#849 / MISE-005PO), not
 * `normalizeTeamMemberEmail` invite / candidate email identity (#674 /
 * #435), and not `utils/restaurantBranding` / `utils/screenTitles`
 * restaurant initials. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so padded account emails cannot invent a clean email
 * label; the live `|| t("settings.account.emailMissing")` branch then
 * preserves the intentional localized fallback. Ordinary ASCII whitespace
 * still trims clean. Case and accents are left unchanged.
 *
 * Complements open More/Settings profile name tip #964 / MISE-005TZ and
 * Team Settings directory tip #965 / MISE-005UA (which explicitly left
 * Settings account email label `.trim()` display alone) without sharing
 * those modules or rewriting profile-name / team-directory / Create Task /
 * greeting / mailbox paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized account email label before it is
 * rendered into Settings account chrome.
 */
export function asciiTrimPresentationSettingsAccountEmailLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Settings account email label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationSettingsAccountEmailLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationSettingsAccountEmailLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize the signed-in account email for Settings label display.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n email-missing fallback) while refusing to invent a clean email via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback branch owns the
 * intentional localized copy without inventing a clean account-email
 * identity from padding.
 */
export function normalizePresentationSettingsAccountEmailLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n fallback. Do not invent an
  // account email label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationSettingsAccountEmailLabel(value);
}

/**
 * Resolve Settings account email label under ASCII C. Soft-null / empty
 * leaves the intentional `|| t("settings.account.emailMissing")` fallback
 * to the caller.
 */
export function presentationSettingsAccountEmailLabel(
  email: string | null | undefined
): string | null {
  return normalizePresentationSettingsAccountEmailLabel(email);
}
