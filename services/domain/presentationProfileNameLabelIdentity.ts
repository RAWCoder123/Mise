/**
 * More / Settings profile name label identity helpers (MISE-005TZ).
 *
 * Pins More `user?.name?.trim() || t("more.profile.fallbackName")` and
 * Settings `user?.name?.trim() || t("settings.account.title")` prep outside
 * the Expo UI graph so Node tests can exercise inventing proofs without
 * loading React Native. Prior More / Settings profile chrome Unicode-trimmed
 * the signed-in display name before rendering the profile name label
 * (`'\u2003Alex Rivera\u2003'.trim() === 'Alex Rivera'`), so NBSP/em-space
 * padding invented a clean profile-name identity rendered into More /
 * Settings account chrome. Soft empty / Unicode-only space also collapsed
 * through `.trim()` into the intentional i18n fallback.
 *
 * These are presentation **More / Settings profile name labels** only — not
 * More / Settings profile avatar initials (#962 / MISE-005TX), not Home /
 * Ask Mise greeting first-name tokens (#961 / MISE-005TW), not outreach
 * greeting `firstName` (#960 / MISE-005TV), not user profile display-name
 * persistence (#849 / MISE-005PO), not Create Task assignee chip labels
 * (#963 / MISE-005TY), not team member directory labels, not Settings
 * account email label `.trim()` display, and not
 * `utils/restaurantBranding` / `utils/screenTitles` restaurant initials.
 * Soft empty / Unicode-padded / control-bearing tokens soft-null so padded
 * profile names cannot invent a clean name label; the live
 * `|| t("more.profile.fallbackName")` /
 * `|| t("settings.account.title")` branches then preserve the intentional
 * localized fallback. Ordinary ASCII whitespace still trims clean. Case
 * and accents are left unchanged.
 *
 * Complements open profile initials tip #962 / MISE-005TX (which explicitly
 * left More / Settings profile **name** label `.trim()` display alone)
 * without sharing that module or rewriting Create Task assignee / team
 * directory / greeting / durable profile-name paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized profile name label before it is rendered
 * into More / Settings profile chrome.
 */
export function asciiTrimPresentationProfileNameLabel(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a More / Settings profile name label under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizePresentationProfileNameLabel(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationProfileNameLabel(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize the signed-in profile name for More / Settings label
 * display. Preserves soft empty → null (prior `.trim()` emptiness →
 * intentional i18n fallback) while refusing to invent a clean name via
 * Unicode em-space trim. Does not throw; Unicode-padded / unsafe /
 * non-string tokens return null so the live fallback branch owns the
 * intentional localized copy without inventing a clean profile-name
 * identity from padding.
 */
export function normalizePresentationProfileNameLabel(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n fallback. Do not invent a
  // profile name label from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationProfileNameLabel(value);
}

/**
 * Resolve More / Settings profile name label under ASCII C. Soft-null /
 * empty leaves the intentional `|| t(...)` fallback to the caller.
 */
export function presentationProfileNameLabel(
  name: string | null | undefined
): string | null {
  return normalizePresentationProfileNameLabel(name);
}
