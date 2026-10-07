/**
 * Demo supplier-order draft price heuristic identity.
 *
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005KH). Only ASCII A-Z is folded; Unicode-aware `toLowerCase`
 * would map Kelvin sign `K` → `k` and invent a demo unit-price match
 * (e.g. `chicken` → 370¢) the ASCII C path would refuse.
 */

/**
 * Trim only ASCII whitespace so demo price tokens stay aligned with
 * sibling Inventory / Scan Item typed-search tips that btrim under
 * COLLATE "C".
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function asciiCTrim(value: string) {
  return value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
}

/**
 * Normalize one supplier-draft item name for the demo unit-price
 * heuristic to ASCII C case fold + ASCII-only end trim. Mid-string
 * non-C whitespace is preserved so em-space / NBSP cannot invent
 * substring identity across lookalike spellings.
 */
export function normalizeOrderPresentationItemToken(
  value: string | null | undefined
): string {
  if (typeof value !== "string") return "";
  return asciiCLower(asciiCTrim(value));
}

const DEMO_UNIT_CENTS = [
  { needle: "tomato", cents: 163 },
  { needle: "onion", cents: 182 },
  { needle: "lemon", cents: 295 },
  { needle: "cilantro", cents: 420 },
  { needle: "garlic", cents: 455 },
  { needle: "cabbage", cents: 210 },
  { needle: "pepper", cents: 235 },
  { needle: "scallion", cents: 385 },
  { needle: "ginger", cents: 315 },
  { needle: "wrapper", cents: 220 },
  { needle: "soy sauce", cents: 850 },
  { needle: "sesame oil", cents: 1125 },
  { needle: "chicken", cents: 370 },
  { needle: "rice", cents: 95 },
  { needle: "beef", cents: 545 },
  { needle: "lettuce", cents: 230 }
] as const;

/**
 * Demo-only unit cents for a supplier-draft line item name. First
 * ASCII C haystack match wins; Kelvin lookalikes cannot invent
 * `chicken` (370¢) or sibling demo prices. Unknown names return 0.
 */
export function estimateOrderPresentationUnitCents(
  itemName: string | null | undefined
): number {
  const normalized = normalizeOrderPresentationItemToken(itemName);
  if (!normalized) return 0;

  for (const entry of DEMO_UNIT_CENTS) {
    if (normalized.includes(entry.needle)) return entry.cents;
  }
  return 0;
}
