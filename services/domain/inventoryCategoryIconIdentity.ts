/**
 * Inventory tab category → icon kind classification.
 *
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KF). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a protein/dairy (or sibling)
 * category icon match the ASCII C path would refuse.
 */

export type InventoryCategoryIconKind =
  | "protein"
  | "produce"
  | "dairy"
  | "dry"
  | "liquid"
  | "package";

/**
 * Trim only ASCII whitespace so category icon tokens stay aligned with
 * sibling Inventory typed-search tips that btrim under COLLATE "C".
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one category label for icon classification to ASCII C case fold
 * + ASCII-only end trim. Mid-string non-C whitespace is preserved so
 * em-space / NBSP cannot invent substring identity across lookalike
 * spellings.
 */
export function normalizeInventoryCategoryIconToken(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return asciiCLower(asciiCTrim(value));
}

function haystackIncludesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Classify an inventory category string into the icon kind used by the
 * Inventory tab. Empty / whitespace-only categories fall through to
 * `package`. Keyword matching is substring-based on the ASCII C haystack
 * only — Kelvin lookalikes cannot invent `chicken` / `milk` (etc.).
 */
export function classifyInventoryCategoryIcon(
  category: string | null | undefined
): InventoryCategoryIconKind {
  const normalized = normalizeInventoryCategoryIconToken(category);
  if (!normalized) return "package";

  if (haystackIncludesAny(normalized, ["protein", "meat", "beef", "chicken"])) {
    return "protein";
  }
  if (haystackIncludesAny(normalized, ["produce", "veg", "fruit"])) {
    return "produce";
  }
  if (haystackIncludesAny(normalized, ["dairy", "milk", "cheese"])) {
    return "dairy";
  }
  if (haystackIncludesAny(normalized, ["dry", "grain", "flour", "rice"])) {
    return "dry";
  }
  if (haystackIncludesAny(normalized, ["oil", "sauce", "liquid"])) {
    return "liquid";
  }
  return "package";
}
