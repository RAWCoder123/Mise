/**
 * Home / Ask Mise presentation greeting first-name identity helpers
 * (MISE-005TW).
 *
 * Pins Home `firstName(user?.name)` and Ask Mise welcome
 * `user?.name?.trim().split(/\s+/)[0]` prep outside the Expo UI graph so
 * Node tests can exercise inventing proofs without loading React Native.
 * Prior presentation greets Unicode-trimmed the signed-in display name
 * before taking the first whitespace token for the on-screen greeting
 * (`'\u2003Alex Rivera\u2003'.trim().split(/\s+/)[0] === 'Alex'`), so
 * NBSP/em-space padding invented a clean greeting identity rendered into
 * Home and Ask Mise copy. Soft-empty / Unicode-only space also collapsed
 * through `.trim()` into the intentional i18n fallback name.
 *
 * These are presentation **greeting first-name tokens** only — not
 * outreach fallback draft `firstName` (#960 / MISE-005TV), not user
 * profile display-name persistence (#849 / MISE-005PO), not Create Task
 * assignee chip labels, not More profile name / initials, and not team
 * member directory labels. Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so padded profile names cannot invent a clean
 * presentation greeting token; the live `|| t("….fallbackName")`
 * branches then preserve the intentional localized fallback. Ordinary
 * ASCII whitespace still trims clean. Case and accents are left
 * unchanged.
 *
 * Complements open outreach greeting tip #960 / MISE-005TV (which
 * explicitly left Home / Ask Mise presentation greets alone) without
 * sharing that module or rewriting durable outreach draft bodies.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized greeting first-name token before it is
 * rendered into Home / Ask Mise greeting copy.
 */
export function asciiTrimPresentationGreetingFirstName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a presentation greeting first-name token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not split on internal whitespace —
 * callers take the first token after successful canonicalize.
 */
export function canonicalizePresentationGreetingFirstNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationGreetingFirstName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Home / Ask Mise greeting `firstName`. Preserves soft
 * empty → null (prior `.trim()` emptiness → i18n fallback name) while
 * refusing to invent a clean first-name token via Unicode em-space trim.
 * Does not throw; Unicode-padded / unsafe / non-string tokens return null
 * so the live `|| t("….fallbackName")` branch owns the intentional
 * fallback without inventing a clean presentation greeting identity from
 * padding.
 */
export function normalizePresentationGreetingFirstName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n greeting fallback. Do not
  // invent a first-name token from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizePresentationGreetingFirstNameToken(value);
  if (!canonical) return null;
  const firstToken = canonical.split(/\s+/)[0] ?? "";
  if (!firstToken) return null;
  return firstToken;
}
