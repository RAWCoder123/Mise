import { normalizeOperationalQuantity } from "./operationalMapping";

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

export type RecipeInventoryUnitConversion =
  | { ok: true; quantity: number; converted: boolean }
  | { ok: false; reason: "invalid_quantity" | "unknown_unit" | "incompatible_units" };

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

/**
 * Convert a recipe baseline quantity into the linked inventory item's unit when
 * both sides share a known same-dimension standard unit (mass, volume, or each).
 * Pack/case/unknown units remain unconverted so setup can skip them explicitly.
 */
export function convertRecipeQuantityToInventoryUnit(input: {
  quantity: number;
  recipeUnit: string | null | undefined;
  inventoryUnit: string | null | undefined;
}): RecipeInventoryUnitConversion {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }

  if (inventoryUnitsAreCompatible(input.inventoryUnit, input.recipeUnit)) {
    return { ok: true, quantity: input.quantity, converted: false };
  }

  const recipeCanonical = normalizeOperationalQuantity({
    quantity: input.quantity,
    unit: String(input.recipeUnit ?? "")
  });
  const inventoryUnitCanonical = normalizeOperationalQuantity({
    quantity: 1,
    unit: String(input.inventoryUnit ?? "")
  });

  if (
    !recipeCanonical.ok ||
    recipeCanonical.quantity == null ||
    recipeCanonical.unit == null ||
    !inventoryUnitCanonical.ok ||
    inventoryUnitCanonical.quantity == null ||
    inventoryUnitCanonical.unit == null
  ) {
    const blockers = [...recipeCanonical.blockers, ...inventoryUnitCanonical.blockers];
    if (
      blockers.includes("unknown_unit") ||
      blockers.includes("pack_conversion_required") ||
      blockers.includes("unverified_pack_conversion") ||
      blockers.includes("invalid_pack_conversion")
    ) {
      return { ok: false, reason: "unknown_unit" };
    }
    return { ok: false, reason: "incompatible_units" };
  }

  if (recipeCanonical.unit !== inventoryUnitCanonical.unit) {
    return { ok: false, reason: "incompatible_units" };
  }

  const converted = recipeCanonical.quantity / inventoryUnitCanonical.quantity;
  if (!Number.isFinite(converted) || converted <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }

  return {
    ok: true,
    quantity: Math.round(converted * 1_000_000) / 1_000_000,
    converted: true
  };
}
