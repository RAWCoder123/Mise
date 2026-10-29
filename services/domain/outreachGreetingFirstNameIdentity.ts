/**
 * Outreach fallback-draft greeting first-name identity helpers (MISE-005TV).
 *
 * Pins domain `buildFallbackOutreachDraft` greeting `firstName` prep outside
 * the Expo UI graph so Node tests can exercise inventing proofs without
 * loading React Native. Prior `firstName` Unicode-trimmed the contact name
 * before taking the first whitespace token for the durable fallback draft
 * body (`'\u2003Alex Rivera\u2003'.trim().split(/\s+/)[0] === 'Alex'`), so
 * NBSP/em-space padding invented a clean greeting identity baked into
 * deterministic outreach draft text. Soft-empty / Unicode-only space also
 * collapsed through `.trim()` into the intentional `"there"` fallback.
 *
 * These are outreach **fallback greeting first-name tokens** only — not
 * domain `normalizeOutreachLead` / `requireText` (#873 / MISE-005QM), not
 * outreach draft `requireBoundedText` (#874 / MISE-005QN), not mailbox
 * `normalizeOutreachEmail` (#420), not Home / Ask Mise presentation
 * `firstName` / `user?.name?.trim().split`, and not user profile display
 * name (#849 / MISE-005PO). Soft empty / Unicode-padded / control-bearing
 * tokens soft-null so padded contact names cannot invent a clean durable
 * greeting token; the live `firstName` path then preserves the prior
 * `"there"` fallback. Ordinary ASCII whitespace still trims clean. Case
 * and accents are left unchanged. First-token length stays capped at 80
 * characters to match the prior `.slice(0, 80)` contract.
 *
 * Complements open outreach lead-text tip #873 / MISE-005QM (which
 * explicitly left greeting `firstName` alone) and draft-text tip #874 /
 * MISE-005QN without sharing those modules or rewriting presentation
 * greetings on Home / Ask Mise. Leave `normalizeOutreachEmail`,
 * `requireText` / `optionalText`, and AI draft bounded text alone for
 * their separate tips.
 */

const MAX_OUTREACH_GREETING_FIRST_NAME = 80;

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized greeting first-name token before it is
 * baked into durable fallback outreach draft body text.
 */
export function asciiTrimOutreachGreetingFirstName(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an outreach greeting first-name token under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not split on internal whitespace —
 * callers take the first token after successful canonicalize.
 */
export function canonicalizeOutreachGreetingFirstNameToken(
  value: string
): string | null {
  const trimmed = asciiTrimOutreachGreetingFirstName(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for outreach greeting `firstName`. Preserves soft empty →
 * null (prior `.trim()` emptiness → `"there"` fallback) while refusing to
 * invent a clean first-name token via Unicode em-space trim. Does not
 * throw; Unicode-padded / unsafe / non-string tokens return null so the
 * live `|| "there"` branch owns the intentional fallback without inventing
 * a clean durable greeting identity from padding.
 */
export function normalizeOutreachGreetingFirstName(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"there"` greeting fallback. Do not
  // invent a first-name token from padding.
  if (!value.trim()) return null;
  const canonical = canonicalizeOutreachGreetingFirstNameToken(value);
  if (!canonical) return null;
  const firstToken = canonical.split(/\s+/)[0] ?? "";
  if (!firstToken) return null;
  return firstToken.slice(0, MAX_OUTREACH_GREETING_FIRST_NAME);
}
