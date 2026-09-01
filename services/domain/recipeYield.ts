/**
 * Read-only recipe yield presentation from `recipe_versions`.
 * Never invents yield factors — missing rows stay `missing`.
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
  return Number.isFinite(value) && value > 0;
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
