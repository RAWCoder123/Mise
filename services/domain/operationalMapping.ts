export type CanonicalOperationalUnit = "g" | "ml" | "each";
export type MappingVerificationStatus = "draft" | "verified" | "rejected" | "expired";

export type MappingBlocker =
  | "invalid_quantity"
  | "unknown_unit"
  | "pack_conversion_required"
  | "unverified_pack_conversion"
  | "invalid_pack_conversion"
  | "density_conversion_required"
  | "unverified_density"
  | "incompatible_dimensions"
  | "pos_mapping_unverified"
  | "pos_mapping_inactive"
  | "recipe_unverified"
  | "recipe_inactive"
  | "invalid_recipe_yield"
  | "missing_ingredients"
  | "ingredient_unverified"
  | "ingredient_unit_invalid"
  | "supplier_mapping_missing"
  | "supplier_mapping_unverified"
  | "supplier_pack_invalid";

export interface VerifiedPackConversion {
  fromUnit: string;
  canonicalQuantity: number;
  canonicalUnit: CanonicalOperationalUnit;
  verified: boolean;
}

export interface ItemDensity {
  gramsPerMilliliter: number;
  verified: boolean;
}

export interface OperationalQuantityResult {
  ok: boolean;
  quantity: number | null;
  unit: CanonicalOperationalUnit | null;
  blockers: MappingBlocker[];
}

export interface EffectiveWindow {
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface OperationalIngredientMapping {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  verificationStatus: MappingVerificationStatus;
  packConversion?: VerifiedPackConversion;
}

export interface OperationalSupplierMapping {
  inventoryItemId: string;
  verificationStatus: MappingVerificationStatus;
  packQuantity: number;
  canonicalUnit: CanonicalOperationalUnit;
}

export interface OperationalMappingChain {
  menuItemId: string;
  posMapping: EffectiveWindow & {
    verificationStatus: MappingVerificationStatus;
    confidence: number;
  };
  recipe: EffectiveWindow & {
    verificationStatus: MappingVerificationStatus;
    prepYield: number;
    cookingYield: number;
    servingQuantity: number;
  };
  ingredients: readonly OperationalIngredientMapping[];
  supplierMappings: readonly OperationalSupplierMapping[];
}

export interface MappingChainAssessment {
  menuItemId: string;
  forecastReady: boolean;
  draftReady: boolean;
  blockers: MappingBlocker[];
}

export interface MappingCoverageResult {
  eligibleSalesVolume: number;
  forecastMappedSalesVolume: number;
  draftMappedSalesVolume: number;
  forecastCoveragePercent: number;
  draftCoveragePercent: number;
  shadowEnabled: boolean;
  draftingEnabled: boolean;
  assessments: MappingChainAssessment[];
}

const DIRECT_UNITS: Readonly<
  Record<string, { multiplier: number; unit: CanonicalOperationalUnit }>
> = {
  g: { multiplier: 1, unit: "g" },
  gram: { multiplier: 1, unit: "g" },
  grams: { multiplier: 1, unit: "g" },
  kg: { multiplier: 1000, unit: "g" },
  kilogram: { multiplier: 1000, unit: "g" },
  kilograms: { multiplier: 1000, unit: "g" },
  oz: { multiplier: 28.349523125, unit: "g" },
  ounce: { multiplier: 28.349523125, unit: "g" },
  ounces: { multiplier: 28.349523125, unit: "g" },
  lb: { multiplier: 453.59237, unit: "g" },
  lbs: { multiplier: 453.59237, unit: "g" },
  pound: { multiplier: 453.59237, unit: "g" },
  pounds: { multiplier: 453.59237, unit: "g" },
  ml: { multiplier: 1, unit: "ml" },
  milliliter: { multiplier: 1, unit: "ml" },
  milliliters: { multiplier: 1, unit: "ml" },
  l: { multiplier: 1000, unit: "ml" },
  liter: { multiplier: 1000, unit: "ml" },
  liters: { multiplier: 1000, unit: "ml" },
  tsp: { multiplier: 4.92892159375, unit: "ml" },
  teaspoon: { multiplier: 4.92892159375, unit: "ml" },
  teaspoons: { multiplier: 4.92892159375, unit: "ml" },
  tbsp: { multiplier: 14.78676478125, unit: "ml" },
  tablespoon: { multiplier: 14.78676478125, unit: "ml" },
  tablespoons: { multiplier: 14.78676478125, unit: "ml" },
  "fl oz": { multiplier: 29.5735295625, unit: "ml" },
  "fluid ounce": { multiplier: 29.5735295625, unit: "ml" },
  "fluid ounces": { multiplier: 29.5735295625, unit: "ml" },
  each: { multiplier: 1, unit: "each" },
  ea: { multiplier: 1, unit: "each" },
  count: { multiplier: 1, unit: "each" },
  unit: { multiplier: 1, unit: "each" }
};

const PACK_UNITS = new Set(["case", "cases", "pack", "packs", "portion", "portions"]);

export function normalizeOperationalQuantity(input: {
  quantity: number;
  unit: string;
  packConversion?: VerifiedPackConversion;
}): OperationalQuantityResult {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return failedQuantity("invalid_quantity");
  }

  const normalizedUnit = normalizeUnit(input.unit);
  const direct = DIRECT_UNITS[normalizedUnit];
  if (direct) {
    return {
      ok: true,
      quantity: input.quantity * direct.multiplier,
      unit: direct.unit,
      blockers: []
    };
  }

  if (!PACK_UNITS.has(normalizedUnit)) return failedQuantity("unknown_unit");
  if (!input.packConversion) return failedQuantity("pack_conversion_required");
  if (!input.packConversion.verified) return failedQuantity("unverified_pack_conversion");
  if (
    normalizeUnit(input.packConversion.fromUnit) !== normalizedUnit ||
    !Number.isFinite(input.packConversion.canonicalQuantity) ||
    input.packConversion.canonicalQuantity <= 0
  ) {
    return failedQuantity("invalid_pack_conversion");
  }

  return {
    ok: true,
    quantity: input.quantity * input.packConversion.canonicalQuantity,
    unit: input.packConversion.canonicalUnit,
    blockers: []
  };
}

export function convertCanonicalDimension(input: {
  quantity: number;
  fromUnit: CanonicalOperationalUnit;
  toUnit: CanonicalOperationalUnit;
  density?: ItemDensity;
}): OperationalQuantityResult {
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    return failedQuantity("invalid_quantity");
  }
  if (input.fromUnit === input.toUnit) {
    return { ok: true, quantity: input.quantity, unit: input.toUnit, blockers: [] };
  }
  if (input.fromUnit === "each" || input.toUnit === "each") {
    return failedQuantity("incompatible_dimensions");
  }
  if (!input.density) return failedQuantity("density_conversion_required");
  if (!input.density.verified) return failedQuantity("unverified_density");
  if (
    !Number.isFinite(input.density.gramsPerMilliliter) ||
    input.density.gramsPerMilliliter <= 0
  ) {
    return failedQuantity("incompatible_dimensions");
  }

  const quantity =
    input.fromUnit === "g"
      ? input.quantity / input.density.gramsPerMilliliter
      : input.quantity * input.density.gramsPerMilliliter;
  return { ok: true, quantity, unit: input.toUnit, blockers: [] };
}

export function assessOperationalMappingChain(
  chain: OperationalMappingChain,
  at: Date = new Date()
): MappingChainAssessment {
  const blockers = new Set<MappingBlocker>();
  if (chain.posMapping.verificationStatus !== "verified") blockers.add("pos_mapping_unverified");
  if (!isWindowActive(chain.posMapping, at)) blockers.add("pos_mapping_inactive");
  if (
    !Number.isFinite(chain.posMapping.confidence) ||
    chain.posMapping.confidence < 0 ||
    chain.posMapping.confidence > 1
  ) {
    blockers.add("pos_mapping_unverified");
  }
  if (chain.recipe.verificationStatus !== "verified") blockers.add("recipe_unverified");
  if (!isWindowActive(chain.recipe, at)) blockers.add("recipe_inactive");
  if (
    !isYield(chain.recipe.prepYield) ||
    !isYield(chain.recipe.cookingYield) ||
    !Number.isFinite(chain.recipe.servingQuantity) ||
    chain.recipe.servingQuantity <= 0
  ) {
    blockers.add("invalid_recipe_yield");
  }
  if (chain.ingredients.length === 0) blockers.add("missing_ingredients");

  for (const ingredient of chain.ingredients) {
    if (ingredient.verificationStatus !== "verified") blockers.add("ingredient_unverified");
    const normalized = normalizeOperationalQuantity(ingredient);
    if (!normalized.ok) blockers.add("ingredient_unit_invalid");
  }

  const forecastBlockers = [...blockers];
  const supplierByInventoryItem = new Map(
    chain.supplierMappings.map((mapping) => [mapping.inventoryItemId, mapping] as const)
  );
  for (const ingredient of chain.ingredients) {
    const supplier = supplierByInventoryItem.get(ingredient.inventoryItemId);
    if (!supplier) {
      blockers.add("supplier_mapping_missing");
      continue;
    }
    if (supplier.verificationStatus !== "verified") blockers.add("supplier_mapping_unverified");
    if (!Number.isFinite(supplier.packQuantity) || supplier.packQuantity <= 0) {
      blockers.add("supplier_pack_invalid");
    }
  }

  return {
    menuItemId: chain.menuItemId,
    forecastReady: forecastBlockers.length === 0,
    draftReady: blockers.size === 0,
    blockers: [...blockers]
  };
}

export function calculateMappingCoverage(input: {
  sales: readonly { menuItemId: string; quantitySold: number }[];
  chains: readonly OperationalMappingChain[];
  at?: Date;
}): MappingCoverageResult {
  const assessments = input.chains.map((chain) =>
    assessOperationalMappingChain(chain, input.at)
  );
  const assessmentByItem = new Map(
    assessments.map((assessment) => [assessment.menuItemId, assessment] as const)
  );
  let eligibleSalesVolume = 0;
  let forecastMappedSalesVolume = 0;
  let draftMappedSalesVolume = 0;

  for (const sale of input.sales) {
    if (!Number.isFinite(sale.quantitySold) || sale.quantitySold <= 0) continue;
    eligibleSalesVolume += sale.quantitySold;
    const assessment = assessmentByItem.get(sale.menuItemId);
    if (assessment?.forecastReady) forecastMappedSalesVolume += sale.quantitySold;
    if (assessment?.draftReady) draftMappedSalesVolume += sale.quantitySold;
  }

  const forecastCoveragePercent = percentage(forecastMappedSalesVolume, eligibleSalesVolume);
  const draftCoveragePercent = percentage(draftMappedSalesVolume, eligibleSalesVolume);
  return {
    eligibleSalesVolume,
    forecastMappedSalesVolume,
    draftMappedSalesVolume,
    forecastCoveragePercent,
    draftCoveragePercent,
    shadowEnabled: eligibleSalesVolume > 0 && forecastCoveragePercent >= 90,
    draftingEnabled: eligibleSalesVolume > 0 && draftCoveragePercent >= 95,
    assessments
  };
}

export function findOverlappingRecipeWindows(
  versions: readonly (EffectiveWindow & { id: string; menuItemId: string; locationId: string | null })[]
) {
  const overlaps: Array<[string, string]> = [];
  for (let leftIndex = 0; leftIndex < versions.length; leftIndex += 1) {
    const left = versions[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < versions.length; rightIndex += 1) {
      const right = versions[rightIndex];
      if (
        !right ||
        left.menuItemId !== right.menuItemId ||
        left.locationId !== right.locationId
      ) {
        continue;
      }
      if (windowsOverlap(left, right)) overlaps.push([left.id, right.id]);
    }
  }
  return overlaps;
}

function isYield(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 1;
}

function isWindowActive(window: EffectiveWindow, at: Date) {
  const atTime = at.getTime();
  const from = new Date(window.effectiveFrom).getTime();
  const to = window.effectiveTo === null ? Number.POSITIVE_INFINITY : new Date(window.effectiveTo).getTime();
  return Number.isFinite(atTime) && Number.isFinite(from) && from <= atTime && atTime < to;
}

function windowsOverlap(left: EffectiveWindow, right: EffectiveWindow) {
  const leftStart = new Date(left.effectiveFrom).getTime();
  const rightStart = new Date(right.effectiveFrom).getTime();
  const leftEnd =
    left.effectiveTo === null ? Number.POSITIVE_INFINITY : new Date(left.effectiveTo).getTime();
  const rightEnd =
    right.effectiveTo === null ? Number.POSITIVE_INFINITY : new Date(right.effectiveTo).getTime();
  if (![leftStart, rightStart, leftEnd, rightEnd].every((value) => !Number.isNaN(value))) {
    return true;
  }
  return leftStart < rightEnd && rightStart < leftEnd;
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10_000) / 100 : 0;
}

function normalizeUnit(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

function failedQuantity(blocker: MappingBlocker): OperationalQuantityResult {
  return { ok: false, quantity: null, unit: null, blockers: [blocker] };
}
