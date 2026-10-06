const unitAliases: Readonly<Record<string, string>> = {
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  kg: "kg",
  kgs: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gram: "g",
  grams: "g",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  ea: "each",
  each: "each",
  unit: "each",
  units: "each",
  case: "case",
  cases: "case",
  pack: "pack",
  packs: "pack",
  head: "head",
  heads: "head"
};

/**
 * ASCII C-locale case fold — mirrors SQL `lower(... collate "C")`
 * (MISE-005JA; complements MISE-005IV / MISE-005IW). Only ASCII A-Z is
 * folded; Unicode-aware `toLowerCase` would map Kelvin sign `K` → `k`
 * and invent a mass alias.
 */
function asciiCLower(value: string) {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

/**
 * Collapse only ASCII whitespace so client unit identity stays aligned with
 * server IMMUTABLE helpers pinned under COLLATE "C".
 */
function asciiCNormalizeUnitToken(value: string) {
  return asciiCLower(value)
    .replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "")
    .replace(/[ \t\n\r\f\v]+/g, " ");
}

export function canonicalInventoryUnit(value: string | null | undefined) {
  const normalized = value == null ? "" : asciiCNormalizeUnitToken(value);
  return unitAliases[normalized] ?? normalized;
}

export function inventoryUnitsAreCompatible(
  inventoryUnit: string | null | undefined,
  recipeUnit: string | null | undefined
) {
  const inventoryKey = canonicalInventoryUnit(inventoryUnit);
  const recipeKey = canonicalInventoryUnit(recipeUnit);
  return inventoryKey.length > 0 && inventoryKey === recipeKey;
}
