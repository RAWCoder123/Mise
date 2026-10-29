/**
 * More / Settings presentation profile avatar-initials identity helpers
 * (MISE-005TX).
 *
 * Pins More and Settings `initialsFor(user?.name || user?.email || "Mise")`
 * prep outside the Expo UI graph so Node tests can exercise inventing
 * proofs without loading React Native. Prior avatar helpers
 * Unicode-trimmed the signed-in display name (or email fallback) before
 * splitting on whitespace and taking the first one or two letter tokens
 * (`'\u2003Alex Rivera\u2003'.trim().split(/\s+/).filter(Boolean)` →
 * `['Alex','Rivera']` → `'AR'`), so NBSP/em-space padding invented clean
 * avatar initials rendered into More and Settings profile chrome. Soft
 * empty / Unicode-only space also collapsed through `.trim()` into the
 * intentional `"M"` empty-avatar fallback.
 *
 * These are presentation **profile avatar initials** only — not Home /
 * Ask Mise greeting first-name tokens (#961 / MISE-005TW), not outreach
 * greeting `firstName` (#960 / MISE-005TV), not user profile display-name
 * persistence (#849 / MISE-005PO), not Create Task assignee chip labels,
 * not More / Settings profile **name** label `.trim()` display, not team
 * member directory labels, and not `utils/restaurantBranding`
 * restaurant initials. Soft empty / Unicode-padded / control-bearing
 * seeds soft-null so padded profile names cannot invent clean avatar
 * initials; callers then keep the intentional `"M"` empty-avatar
 * fallback. Ordinary ASCII whitespace still trims clean. Case folding
 * for the rendered initials remains caller-owned (`toUpperCase`).
 *
 * Complements open presentation greeting tip #961 / MISE-005TW (which
 * explicitly left More profile initials alone) without sharing that
 * module or rewriting greeting / outreach / durable profile-name paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized profile-name seed before avatar
 * initials are derived for More / Settings chrome.
 */
export function asciiTrimPresentationProfileInitialsSeed(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a presentation profile-initials seed under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls. Does not derive initials — callers split
 * after successful canonicalize.
 */
export function canonicalizePresentationProfileInitialsSeed(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationProfileInitialsSeed(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for More / Settings profile avatar-initials seeds.
 * Preserves soft empty → null (prior `.trim()` emptiness → `"M"`
 * fallback) while refusing to invent a clean name/email seed via Unicode
 * em-space trim. Does not throw; Unicode-padded / unsafe / non-string
 * tokens return null so the live empty-avatar `"M"` branch owns the
 * intentional fallback without inventing clean initials from padding.
 */
export function normalizePresentationProfileInitialsSeed(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional `"M"` avatar fallback. Do not
  // invent a seed from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationProfileInitialsSeed(value);
}

/**
 * Derive More / Settings profile avatar initials under ASCII C. Soft-null
 * / empty seeds keep the intentional `"M"` fallback. Single-token seeds
 * take the first two characters; multi-token seeds take the first
 * character of the first two whitespace-separated tokens.
 */
export function presentationProfileInitialsFromSeed(
  value: string | null | undefined
): string {
  const canonical = normalizePresentationProfileInitialsSeed(value);
  if (!canonical) return "M";
  const parts = canonical.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "M";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}
