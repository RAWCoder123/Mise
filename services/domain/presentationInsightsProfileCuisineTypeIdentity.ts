/**
 * Insights analytics profile cuisine-type identity helpers (MISE-005UF).
 *
 * Pins Insights Sales Analytics profile chip
 * `cuisineType?.trim() || t("insights.analytics.profile.unknown")`
 * prep outside the Expo UI graph so Node tests can exercise inventing
 * proofs without loading React Native. Prior Insights profile chrome
 * Unicode-trimmed the cuisine type before rendering the cuisine
 * ProfileChip (`'\u2003Italian\u2003'.trim() === 'Italian'`), so
 * NBSP/em-space padding invented a clean cuisine identity rendered
 * into Insights analytics profile chrome. Soft empty / Unicode-only
 * space also collapsed through `.trim()` into the intentional i18n
 * unknown-profile fallback.
 *
 * These are presentation **Insights analytics profile cuisine-type
 * labels** only — not Insights restaurant-name profile chip labels
 * (#969 / MISE-005UE), not Today screen title restaurant-name prep
 * (#968 / MISE-005UD), not restaurant branding initials (#967 /
 * MISE-005UC), not Settings account email labels (#966 / MISE-005UB),
 * not Team Settings directory labels (#965 / MISE-005UA), not More /
 * Settings profile name labels (#964 / MISE-005TZ), not Create Task
 * assignee chip labels (#963 / MISE-005TY), not More / Settings profile
 * avatar initials (#962 / MISE-005TX), not Home / Ask Mise greeting
 * first-name tokens (#961 / MISE-005TW), not outreach greeting
 * `firstName` (#960 / MISE-005TV), not outreach-webhook From mailbox
 * prep (#959 / MISE-005TU), and not user profile display-name
 * persistence (#849 / MISE-005PO). Soft empty / Unicode-padded /
 * control-bearing seeds soft-null so padded cuisine types cannot
 * invent a clean Insights profile label; callers then keep the
 * intentional `|| t("insights.analytics.profile.unknown")` fallback.
 * Ordinary ASCII whitespace still trims clean. Case and accents are
 * left unchanged. The full cuisine type (not a first-token slice)
 * is the profile seed.
 *
 * Complements open Insights profile restaurant-name tip #969 /
 * MISE-005UE (which pins the sibling restaurant ProfileChip) without
 * sharing that module or rewriting restaurant-name / branding /
 * greeting / directory / profile label paths.
 */

/**
 * ASCII-only end trim; Unicode `String#trim` would strip NBSP / em-space
 * padding and invent a normalized cuisine-type seed before it is
 * rendered into the Insights analytics profile cuisine chip.
 */
export function asciiTrimPresentationInsightsProfileCuisineType(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Canonicalize an Insights analytics profile cuisine-type seed under
 * ASCII C. Returns null when empty after ASCII trim, still Unicode-padded,
 * or containing ASCII controls. Does not split on internal whitespace —
 * the full cuisine type is the profile seed.
 */
export function canonicalizePresentationInsightsProfileCuisineType(
  value: string
): string | null {
  const trimmed = asciiTrimPresentationInsightsProfileCuisineType(value);
  if (!trimmed) return null;
  // Fail closed when Unicode trim would still strip end padding (NBSP/em-space).
  if (trimmed !== trimmed.trim()) return null;
  if (hasControlCharacters(trimmed)) return null;
  return trimmed;
}

/**
 * Soft normalize for Insights analytics profile cuisine types.
 * Preserves soft empty → null (prior `.trim()` emptiness → intentional
 * i18n unknown-profile fallback) while refusing to invent a clean
 * cuisine-type seed via Unicode em-space trim. Does not throw;
 * Unicode-padded / unsafe / non-string tokens return null so the live
 * `|| t("insights.analytics.profile.unknown")` branch owns the
 * intentional fallback without inventing a clean profile identity from
 * padding.
 */
export function normalizePresentationInsightsProfileCuisineType(
  value: string | null | undefined
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  // Soft empty for Unicode-only space (em-space alone): prior `.trim()`
  // emptied those into the intentional i18n unknown-profile fallback. Do
  // not invent a cuisine-type seed from padding.
  if (!value.trim()) return null;
  return canonicalizePresentationInsightsProfileCuisineType(value);
}

/**
 * Resolve Insights analytics profile cuisine-type label under ASCII C.
 * Soft-null / empty leaves the intentional
 * `|| t("insights.analytics.profile.unknown")` fallback to the caller.
 */
export function presentationInsightsProfileCuisineType(
  cuisineType: string | null | undefined
): string | null {
  return normalizePresentationInsightsProfileCuisineType(cuisineType);
}
