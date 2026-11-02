/**
 * Demo/setup readiness cuisine_type identity helpers (MISE-005VY).
 *
 * Pins miseDomain cuisine readiness that previously decided ready/attention
 * and selected evidence with a raw Unicode-trim / nullish-coalescing gate:
 *
 * ```ts
 * status: restaurant.name.trim() && restaurant.cuisine_type?.trim()
 *   ? "ready" : "attention",
 * evidence: restaurant.cuisine_type ?? "Cuisine not set",
 * ```
 *
 * and the setup-readiness profile missing list:
 *
 * ```ts
 * !restaurant.cuisine_type?.trim() ? "cuisine/service style" : null,
 * ```
 *
 * A Unicode-only-space cuisine_type (`"\u2003"`) is non-nullish under `??`,
 * so demo readiness evidence rendered the padding (or bypassed the
 * intentional hard-coded `"Cuisine not set"` empty-state) instead of
 * failing closed. Empty string has the same `??` bypass
 * (`("" ?? FALLBACK) === ""`). Separately, Unicode `.trim()` on a padded
 * cuisine (`"\u2003Coastal Seafood\u2003".trim() === "Coastal Seafood"`)
 * would invent a clean cuisine identity and mark profile ready / omit
 * `"cuisine/service style"` from setup missing when only padding was
 * stored.
 *
 * Single-line cuisine tips use ASCII end trim only and preserve NBSP (no
 * fold into plain space). Soft-null when Unicode trim would still strip
 * end padding (NBSP / em-space) so padding cannot invent equality with an
 * unpadded cuisine type. Accents and case are preserved. Full C0/DEL
 * control rejection applies (no LF/TAB/CR allowlist).
 *
 * These are miseDomain **demo/setup readiness cuisine_type** tokens only —
 * the `buildDemoReadinessSummary` profile status/evidence path that falls
 * through to `"Cuisine not set"`, and the `buildSetupReadinessSummary`
 * profile missing `"cuisine/service style"` emptiness gate. Not Insights
 * hub subtitle cuisine (#1029 / MISE-005VU), not Settings workspace
 * cuisine_type meta (#1023 / MISE-005VO), not Insights profile cuisine
 * ProfileChip (#970 / MISE-005UF), not restaurant branding initials /
 * English cuisine (#967 / MISE-005UC), not durable
 * `requireRestaurantCuisineType` writer identity (#842 / MISE-005PH), not
 * restaurants.cuisine CHECK pins (#549), and not restaurant-name
 * inventing. Soft empty / Unicode-padded / control-bearing tokens
 * soft-null so the live `"Cuisine not set"` / `"cuisine/service style"`
 * branches own the intentional empty states. Ordinary ASCII whitespace
 * still trims clean.
 *
 * Complements open #1032 / #1031 / #1029 / #1023 / #970 / #967 / #842 /
 * #549 on other cuisine / readiness tips without sharing those modules
 * or rewriting their call sites.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized miseDomain readiness cuisine before it
 * is used for demo profile evidence or setup missing gates.
 */
export function asciiTrimDemoReadinessCuisine(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize a miseDomain readiness cuisine_type under ASCII C.
 * Returns null when empty after ASCII trim, still Unicode-padded, or
 * containing ASCII controls.
 */
export function canonicalizeDemoReadinessCuisine(value: string): string | null {
  const trimmed = asciiTrimDemoReadinessCuisine(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize one miseDomain readiness cuisine_type candidate.
 * Preserves soft empty → null (intentional hard-coded `"Cuisine not set"` /
 * `"cuisine/service style"` copy) while refusing to invent a clean cuisine
 * via Unicode em-space / NBSP trim. Does not throw; Unicode-padded /
 * unsafe / non-string tokens return null so the live demo evidence and
 * setup missing branches own the fallback without inventing a clean
 * cuisine from padding, without letting truthy Unicode-only space mark
 * profile ready, and without letting non-nullish Unicode-only space or
 * empty string bypass `"Cuisine not set"` through the prior `??` row.
 */
export function normalizeDemoReadinessCuisine(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): non-nullish padding
  // previously bypassed `"Cuisine not set"` via `??`, and Unicode `.trim()`
  // emptiness gates treated padded cuisines as present. Do not invent a
  // clean miseDomain readiness cuisine from padding.
  if (!value.trim()) return null;
  return canonicalizeDemoReadinessCuisine(value);
}
