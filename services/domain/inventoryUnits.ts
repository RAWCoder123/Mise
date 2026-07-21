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

export function canonicalInventoryUnit(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
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
