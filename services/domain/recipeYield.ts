/**
 * Recipe yield presentation and manager write helpers for `recipe_versions`.
 * Never invents yield factors — missing rows stay `missing`.
 * Verified yields are never mutated in place; edits go through draft successors.
 */

export type RecipeVersionYieldStatus = "draft" | "verified" | "retired";

export interface RecipeVersionYield {
  id: string;
  restaurantId: string;
  menuItemId: string;
  status: RecipeVersionYieldStatus;
  servingQuantity: number;
  prepYield: number;
  cookingYield: number;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Null means restaurant-wide; location-specific versions stay secondary for hub display. */
  locationId: string | null;
}

export interface RecipeVersionYieldInput {
  restaurantId: string;
  menuItemId: string;
  servingQuantity: number;
  prepYield: number;
  cookingYield: number;
  recipeVersionId?: string | null;
}

const MAX_SERVING_QUANTITY = 10_000;

export const recipeYieldLimits = {
  maxServingQuantity: MAX_SERVING_QUANTITY
} as const;

export type RecipeYieldReadout =
  | {
      status: "recorded";
      recipeVersionId: string;
      versionStatus: "draft" | "verified";
      servingQuantity: number;
      prepYield: number;
      cookingYield: number;
      /**
       * Multiplier from plated serving back to raw usage:
       * servingQuantity / (prepYield * cookingYield).
       */
      rawUsageMultiplier: number;
    }
  | { status: "missing" };

export function isValidRecipeYieldFactor(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 1;
}

export function isValidServingQuantity(value: number) {
  return Number.isFinite(value) && value > 0 && value <= MAX_SERVING_QUANTITY;
}

export function isRecipeVersionYieldStatus(value: unknown): value is RecipeVersionYieldStatus {
  return value === "draft" || value === "verified" || value === "retired";
}

export function requireRecipeYieldFactor(value: unknown): number {
  const factor = typeof value === "number" ? value : Number(value);
  if (!isValidRecipeYieldFactor(factor)) {
    throw new Error("Recipe yield factor must be greater than 0 and at most 1.");
  }
  return factor;
}

export function requireServingQuantity(value: unknown): number {
  const quantity = typeof value === "number" ? value : Number(value);
  if (!isValidServingQuantity(quantity)) {
    throw new Error(
      `Serving quantity must be greater than 0 and no more than ${MAX_SERVING_QUANTITY.toLocaleString()}.`
    );
  }
  return quantity;
}

/**
 * Convert an operator-facing percent (1–100) into a stored yield factor (0–1].
 * Rejects 0% and values above 100%.
 */
export function requireYieldPercentAsFactor(value: unknown): number {
  const percent = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    throw new Error("Yield percent must be greater than 0 and at most 100.");
  }
  return requireRecipeYieldFactor(percent / 100);
}

export function normalizeRecipeVersionYield(row: Record<string, unknown>): RecipeVersionYield {
  const status = row.status;
  if (!isRecipeVersionYieldStatus(status)) {
    throw new Error("Recipe version yield status is invalid.");
  }
  const id = String(row.id ?? "");
  const restaurantId = String(row.restaurant_id ?? row.restaurantId ?? "");
  const menuItemId = String(row.menu_item_id ?? row.menuItemId ?? "");
  const servingQuantity = requireServingQuantity(row.serving_quantity ?? row.servingQuantity);
  const prepYield = requireRecipeYieldFactor(row.prep_yield ?? row.prepYield);
  const cookingYield = requireRecipeYieldFactor(row.cooking_yield ?? row.cookingYield);
  const versionNumber = Number(row.version_number ?? row.versionNumber);
  const effectiveFrom = String(row.effective_from ?? row.effectiveFrom ?? "");
  const locationRaw = row.pos_location_id ?? row.locationId ?? row.location_id;
  if (
    !id
    || !restaurantId
    || !menuItemId
    || !Number.isSafeInteger(versionNumber)
    || versionNumber <= 0
    || !effectiveFrom
  ) {
    throw new Error("Recipe version yield identity is incomplete.");
  }
  return {
    id,
    restaurantId,
    menuItemId,
    status,
    servingQuantity,
    prepYield,
    cookingYield,
    versionNumber,
    effectiveFrom,
    effectiveTo:
      row.effective_to == null && row.effectiveTo == null
        ? null
        : String(row.effective_to ?? row.effectiveTo),
    locationId: locationRaw == null || locationRaw === "" ? null : String(locationRaw)
  };
}

export function computeRawUsageMultiplier(
  servingQuantity: number,
  prepYield: number,
  cookingYield: number
): number | null {
  if (
    !isValidServingQuantity(servingQuantity)
    || !isValidRecipeYieldFactor(prepYield)
    || !isValidRecipeYieldFactor(cookingYield)
  ) {
    return null;
  }
  const denominator = prepYield * cookingYield;
  if (!(denominator > 0)) return null;
  return roundMultiplier(servingQuantity / denominator);
}

export function presentRecipeYieldReadout(version: RecipeVersionYield | null): RecipeYieldReadout {
  if (!version || version.status === "retired") return { status: "missing" };
  if (version.status !== "draft" && version.status !== "verified") return { status: "missing" };

  const multiplier = computeRawUsageMultiplier(
    version.servingQuantity,
    version.prepYield,
    version.cookingYield
  );
  if (multiplier === null) return { status: "missing" };

  return {
    status: "recorded",
    recipeVersionId: version.id,
    versionStatus: version.status,
    servingQuantity: version.servingQuantity,
    prepYield: version.prepYield,
    cookingYield: version.cookingYield,
    rawUsageMultiplier: multiplier
  };
}

/**
 * Picks the current restaurant-facing yield row for a menu item.
 * Prefers an active verified restaurant-wide version, then draft, then
 * location-specific rows. Returns null when nothing is currently effective.
 */
export function selectCurrentRecipeVersionYield(
  versions: readonly RecipeVersionYield[],
  menuItemId: string,
  at: Date = new Date()
): RecipeVersionYield | null {
  const normalizedMenuItemId = menuItemId.trim();
  if (!normalizedMenuItemId) return null;

  const active = versions.filter(
    (version) =>
      version.menuItemId === normalizedMenuItemId
      && version.status !== "retired"
      && isWindowActive(version, at)
      && isValidServingQuantity(version.servingQuantity)
      && isValidRecipeYieldFactor(version.prepYield)
      && isValidRecipeYieldFactor(version.cookingYield)
  );
  if (active.length === 0) return null;

  return active.slice().sort(compareRecipeVersionYieldPreference)[0] ?? null;
}

function compareRecipeVersionYieldPreference(left: RecipeVersionYield, right: RecipeVersionYield) {
  const statusRank = (status: RecipeVersionYieldStatus) => (status === "verified" ? 0 : 1);
  const byStatus = statusRank(left.status) - statusRank(right.status);
  if (byStatus !== 0) return byStatus;

  const leftWide = left.locationId == null ? 0 : 1;
  const rightWide = right.locationId == null ? 0 : 1;
  if (leftWide !== rightWide) return leftWide - rightWide;

  if (right.versionNumber !== left.versionNumber) return right.versionNumber - left.versionNumber;
  return right.id.localeCompare(left.id);
}

function isWindowActive(
  window: Pick<RecipeVersionYield, "effectiveFrom" | "effectiveTo">,
  at: Date
) {
  const atTime = at.getTime();
  const from = new Date(window.effectiveFrom).getTime();
  const to =
    window.effectiveTo === null ? Number.POSITIVE_INFINITY : new Date(window.effectiveTo).getTime();
  return Number.isFinite(atTime) && Number.isFinite(from) && from <= atTime && atTime < to;
}

function roundMultiplier(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
