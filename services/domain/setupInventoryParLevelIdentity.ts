/**
 * Setup inventory par-level draft helpers (MISE-005RH).
 *
 * Pins `app/(auth)/setup.tsx` inventory `parLevel` prep outside the React
 * Native screen graph so Node tests can exercise inventing proofs without
 * loading Expo. The prior path fed those drafts into `item.parLevel.trim()`
 * emptiness / optional-range gates and locale `parseNumber` via
 * `isBoundedSetupNumber` / `normalizeDraftNumber`, which Unicode-trim before
 * parsing (`'\u200312\u2003'.trim() === '12'`), so NBSP / em-space padding
 * invented a clean par level the operator did not type as ordinary ASCII
 * digits. Unicode-only space also invented the optional-empty branch via
 * `'\u2003'.trim() === ''`.
 *
 * These are single-line setup inventory **parLevel** drafts only — not setup
 * inventory on-hand `quantity` (still bare `normalizeDraftNumber` /
 * `isBoundedSetupNumber`), not inventory detail settings quantities (open
 * #893 / MISE-005RG), not inventory detail operation `quantityText` (open
 * #892 / MISE-005RF), not Log Delivery quantities (open #891 / MISE-005RE),
 * not inventory count `draftCounts` (open #890 / MISE-005RD), not Orders
 * recommendation quantities (open #889 / MISE-005RC), and not free-form
 * notes. Soft empty (ASCII whitespace or Unicode-only space) stays `empty`
 * so callers keep the prior optional-par emptiness contract. Ordinary ASCII
 * whitespace still trims clean before locale `parseNumber`. Unicode-padded
 * or control-bearing drafts fail closed as `invalid` so padded `"12"` cannot
 * invent a par level.
 *
 * Complements open inventory detail settings quantity tip #893 / MISE-005RG
 * without sharing that module. Locale parsing stays on the screen via
 * `parseNumber`; this module only refuses to invent a clean draft string.
 */

export type SetupInventoryParLevelPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` / `parseLocalizedNumber` TrimString
 * would strip NBSP / em-space padding and invent a normalized setup par level
 * before save.
 */
export function asciiTrimSetupInventoryParLevelText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a setup inventory par-level draft under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for locale `parseNumber`.
 */
export function canonicalizeSetupInventoryParLevelText(
  value: string
): SetupInventoryParLevelPrep {
  const trimmed = asciiTrimSetupInventoryParLevelText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for setup inventory par-level validate / normalize.
 * Preserves soft empty → `empty` (prior optional `item.parLevel.trim()`
 * emptiness) while refusing to invent a clean draft via Unicode em-space /
 * NBSP trim. Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareSetupInventoryParLevelText(
  value: unknown
): SetupInventoryParLevelPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `item.parLevel.trim()` / `normalizeDraftNumber` emptied those into the
  // optional-empty / blank-normalize branch.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeSetupInventoryParLevelText(value);
}
