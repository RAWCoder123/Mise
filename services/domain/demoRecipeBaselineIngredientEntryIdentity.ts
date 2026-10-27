/**
 * Demo recipe-baseline ingredient-entry helpers (MISE-005RT).
 *
 * Pins `services/demo/replaceableDemoData.ts` `parseRecipeLine` comma-separated
 * ingredient-entry prep outside the React Native screen graph so Node tests
 * can exercise inventing proofs without loading Expo. The prior path fed each
 * comma entry through `entry.trim()` before the quantity/unit regex and
 * durable demo menu-item ingredient mappings via `applyRecipeBaselineText` /
 * `applyDemoSetupProfile`, which Unicode-trim before parse
 * (`'\u2003chicken breast 0.25 lbs\u2003'.trim() === 'chicken breast 0.25 lbs'`),
 * so NBSP / em-space padding invented a clean ingredient entry the operator
 * did not type as ordinary ASCII text. Unicode-only space also invented an
 * empty entry via `'\u2003'.trim() === ''` that the empty filter dropped.
 *
 * These are replaceable-demo **recipe-baseline ingredient entry** drafts only —
 * not demo recipe-baseline menuItemName (open #905 / MISE-005RS), not
 * ingredient `itemName` / `unit` bare trim inside the same parser after the
 * entry is prepared, not setup-drafts recipe ingredient itemName / unit /
 * quantity tokens (open #898 / #899 / #897), not application/setup recipe
 * ingredient saves (open #902 / #901), and not free-form notes. Soft empty
 * (ASCII whitespace or Unicode-only space) stays `empty` so callers keep the
 * prior empty-after-trim skip contract. Ordinary ASCII whitespace still trims
 * clean before the quantity/unit regex. Unicode-padded or control-bearing
 * drafts fail closed as `invalid` so padded `"chicken breast 0.25 lbs"` cannot
 * invent a clean parse.
 *
 * Complements open demo menuItemName tip #905 / MISE-005RS without sharing
 * that module. Leave `menuItemName.trim()`, `match[1]!.trim()`,
 * `match[3]!.trim()`, soft-empty `recipeBaselineText?.trim()`, and line.trim()
 * alone until their own tips own those paths.
 */

export type DemoRecipeBaselineIngredientEntryPrep =
  | { status: "empty" }
  | { status: "ok"; text: string }
  | { status: "invalid" };

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized demo recipe-baseline ingredient entry
 * before the quantity/unit regex and durable mappings.
 */
export function asciiTrimDemoRecipeBaselineIngredientEntryText(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a demo recipe-baseline ingredient entry under ASCII C.
 * Returns `empty` when blank after ASCII trim, `invalid` when still
 * Unicode-padded / control-bearing, otherwise `ok` with the ASCII-trimmed
 * text for regex parse / durable mapping.
 */
export function canonicalizeDemoRecipeBaselineIngredientEntryText(
  value: string
): DemoRecipeBaselineIngredientEntryPrep {
  const trimmed = asciiTrimDemoRecipeBaselineIngredientEntryText(value);
  if (!trimmed) return { status: "empty" };
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return { status: "invalid" };
  if (hasControlCharacters(trimmed)) return { status: "invalid" };
  return { status: "ok", text: trimmed };
}

/**
 * Soft normalize for demo recipe-baseline ingredient-entry parse.
 * Preserves soft empty → `empty` (prior `entry.trim()` empty path) while
 * refusing to invent a clean draft via Unicode em-space / NBSP trim.
 * Non-string and control-bearing / padded tokens are `invalid`.
 */
export function prepareDemoRecipeBaselineIngredientEntryText(
  value: unknown
): DemoRecipeBaselineIngredientEntryPrep {
  if (typeof value !== "string") return { status: "invalid" };
  if (value === "") return { status: "empty" };
  // Soft empty for Unicode-only space (em-space alone): prior
  // `entry.trim()` emptied those into the empty-entry skip.
  if (!value.trim()) return { status: "empty" };
  return canonicalizeDemoRecipeBaselineIngredientEntryText(value);
}
