/**
 * Team Settings directory member label identity helpers (MISE-005UA).
 *
 * Pins Team Settings `member.name?.trim() || member.email?.trim() ||
 * t("team.member.unnamed")` and `member.email?.trim() ||
 * t("team.member.emailMissing")` prep outside the Expo UI graph so Node
 * tests can exercise inventing proofs without loading React Native. Prior
 * directory chrome Unicode-trimmed the teammate display name (then email
 * fallback) and the email subtitle before rendering
 * (`'\u2003Alex Rivera\u2003'.trim() === 'Alex Rivera'`), so NBSP/em-space
 * padding invented a clean directory identity rendered into Team Settings
 * member chrome. Soft empty / Unicode-only space also collapsed through
 * `.trim()` into the intentional i18n unnamed / email-missing fallbacks.
 *
 * These are presentation **Team Settings directory labels** only — not
 * Create Task assignee chip labels (#963 / MISE-005TY), not More /
 * Settings profile name labels (#964 / MISE-005TZ), not More / Settings
 * profile avatar initials (#962 / MISE-005TX), not Home / Ask Mise
 * greeting first-name tokens (#961 / MISE-005TW), not outreach greeting
 * `firstName` (#960 / MISE-005TV), not user profile display-name
 * persistence (#849 / MISE-005PO), not Settings account email label
 * `.trim()` display, not domain `normalizeTeamMemberEmail` invite /
 * candidate email identity (#674 / #435), and not
 * `utils/restaurantBranding` / `utils/screenTitles` restaurant initials.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so
 * padded teammate names or emails cannot invent a clean directory label;
 * the live `|| t("team.member.unnamed")` / `|| t("team.member.emailMissing")`
 * branches then preserve the intentional localized fallbacks. Ordinary
 * ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open Create Task assignee tip #963 / MISE-005TY and
 * More/Settings profile name tip #964 / MISE-005TZ (which explicitly
 * left Team Settings directory labels alone) without sharing those
 * modules or rewriting Create Task / Settings account email paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized directory label before it is rendered
 * into Team Settings member chrome.
 */
export function asciiTrimPresentationTeamDirectoryLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a Team Settings directory label token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not prefer name over email — callers
 * sequence name then email after successful canonicalize.
 */
export function canonicalizePresentationTeamDirectoryLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationTeamDirectoryLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one Team Settings directory label candidate (name or
 * email). Preserves soft empty → null (prior `.trim()` emptiness → next
 * candidate or i18n unnamed / email-missing fallback) while refusing to
 * invent a clean label via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * fallback chain owns the intentional copy without inventing a clean
 * directory identity from padding.
 */
export function normalizePresentationTeamDirectoryLabelToken(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the next candidate / intentional i18n fallback.
  // Do not invent a label token from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationTeamDirectoryLabel(value);
}

/**
 * Resolve Team Settings directory primary member label under ASCII C.
 * Prefers a canonical name, then a canonical email. Soft-null / empty
 * candidates leave the intentional `|| t("team.member.unnamed")`
 * fallback to the caller.
 */
export function presentationTeamDirectoryMemberLabel(
  name: string | null | undefined,
  email: string | null | undefined
): string | null {
  return (
    normalizePresentationTeamDirectoryLabelToken(name) ??
    normalizePresentationTeamDirectoryLabelToken(email)
  );
}

/**
 * Resolve Team Settings directory email subtitle under ASCII C.
 * Soft-null / empty candidates leave the intentional
 * `|| t("team.member.emailMissing")` fallback to the caller.
 */
export function presentationTeamDirectoryEmailLabel(
  email: string | null | undefined
): string | null {
  return normalizePresentationTeamDirectoryLabelToken(email);
}
