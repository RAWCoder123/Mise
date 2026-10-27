/**
 * Demo recipe-baseline line helpers (MISE-005RU).
 *
 * Pins `services/demo/replaceableDemoData.ts` `applyRecipeBaselineText`
 * per-line prep outside the React Native screen graph so Node tests can
 * exercise inventing proofs without loading Expo. The prior path fed each
 * newline-split recipe-baseline line through `line.trim()` before
 * `parseRecipeLine` and durable demo menu-item ingredient mappings via
 * `applyDemoSetupProfile`, which Unicode-trim before parse
 * (`'\u2003Unique Demo Bowl: chicken breast 0.25 lbs\u2003'.trim() ===
 * 'Unique Demo Bowl: chicken breast 0.25 lbs'`), so NBSP / em-space padding
 * invented a clean recipe-baseline line the operator did not type as
 * ordinary ASCII text. Unicode-only space also invented an empty line via
 * `'\u2003'.trim() === ''` that the empty filter dropped.
 *
 * These are replaceable-demo **recipe-baseline lines** only — not demo
 * recipe-baseline menuItemName (open #905 / MISE-005RS), not comma-separated
 * ingredient entries (open #906 / MISE-005RT), not ingredient `itemName` /
 * `unit` bare trim inside the same parser, not soft-empty
 * `recipeBaselineText?.trim()`, not setup-drafts recipe dishName / ingredient
 * tokens (open #900 / #898 / #899 / #897), not setup-drafts POS CSV
 * `line.trim()`, and not free-form notes. Soft empty (ASCII whitespace or
 * Unicode-only space) stays `empty` so callers keep the prior empty-after-trim
 * skip contract. Ordinary ASCII whitespace still trims clean before
 * `parseRecipeLine`. Unicode-padded or control-bearing drafts fail closed as
 * `invalid` so padded full lines cannot invent a clean parse.
 *
 * Complements open demo menuItemName tip #905 / MISE-005RS and ingredient-entry
 * tip #906 / MISE-005RT without sharing those modules. Leave
 * `menuItemName.trim()`, `entry.trim()`, `match[1]!.trim()`,
 * `match[3]!.trim()`, and soft-empty `recipeBaselineText?.trim()` alone until
 * their own tips own those paths.
 */

export type DemoRecipeBaselineLinePrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo recipe-baseline line before
 * `parseRecipeLine` and durable mappings.
 */
export function asciiTrimDemoRecipeBaselineLineText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo recipe-baseline line under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for `parseRecipeLine` / durable mapping.
 */
export function canonicalizeDemoRecipeBaselineLineText(
  value: string
): DemoRecipeBaselineLinePrep {
  const trimmed = asciiTrimDemoRecipeBaselineLineText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for demo recipe-baseline line parse.
 * Preserves soft empty → `empty` (prior `line.trim()` empty path) while
 * refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareDemoRecipeBaselineLineText(
  value: unknown
): DemoRecipeBaselineLinePrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `line.trim()` emptied those into the empty-line skip.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeDemoRecipeBaselineLineText(value);
}
