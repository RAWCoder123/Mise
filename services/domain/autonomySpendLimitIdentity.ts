/**
 * Autonomy-settings spend-limit draft identity helpers (MISE-005RB).
 *
 * Pins `app/settings/autonomy.tsx` draft spendLimitText prep outside the React
 * Native screen graph so Node tests can exercise inventing proofs without
 * loading Expo. The prior path Unicode-trimmed the draft for emptiness and
 * relied on ECMAScript `Number` (Unicode TrimString) for parsing
 * (`Number('\u200325.50\u2003') === 25.5` → `2550` cents), so NBSP / em-space
 * padding invented a clean spend ceiling the operator did not type as ordinary
 * ASCII digits. Unicode-only space also invented the empty / no-limit branch
 * via `'\u2003'.trim() === ''`.
 *
 * These are single-line currency draft strings used only for the owner/admin
 * Autonomy Settings save path, not free-form multiline prose, not the
 * communication-channel tip (#877 / MISE-005QQ), and not the allowed-window
 * clock tip (#878 / MISE-005QR). Soft empty (ASCII whitespace or Unicode-only
 * space) stays the empty / `null` cents branch so callers keep the prior
 * `.trim()` emptiness → no spend-limit contract. Ordinary ASCII whitespace
 * still trims clean before `Number`. Unicode-padded, control-bearing,
 * non-finite, or negative drafts fail closed as `invalid` so padded `"25.50"`
 * cannot invent unlimited (`null`) or invent `2550` cents.
 *
 * Complements open autonomy communicationType tip #877 / MISE-005QQ and
 * allowed-window tip #878 / MISE-005QR without rewriting those modules or the
 * autonomy restaurant-workspace tip (#741 / MISE-005LK).
 */

export type AutonomySpendLimitParse =
  | { status: "empty" }
  | { status: "ok"; cents: number }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / ECMAScript `Number` TrimString
 * would strip NBSP / em-space padding and invent a normalized spend-limit
 * draft before save.
 */
export function asciiTrimAutonomySpendLimitText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an autonomy spend-limit draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing / non-finite / negative, otherwise `ok`
 * with integer cents (`Math.round(amount * 100)`), matching the prior save
 * contract for ordinary ASCII drafts.
 */
export function canonicalizeAutonomySpendLimitText(value: string): AutonomySpendLimitParse {
  const trimmed = asciiTrimAutonomySpendLimitText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return { status: "invalid" };
  return { status: "ok", cents: Math.round(amount * 100) };
}

/**
 * Soft normalize for Autonomy Settings spend-limit save.
 * Preserves soft empty → `empty` (prior `.trim()` emptiness → `null` cents)
 * while refusing to invent a clean amount via Unicode em-space / NBSP trim or
 * `Number` TrimString. Non-string and control-bearing / padded / malformed
 * tokens are `invalid`.
 */
export function parseAutonomySpendLimitText(value: unknown): AutonomySpendLimitParse {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the null spend-limit branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeAutonomySpendLimitText(value);
}
