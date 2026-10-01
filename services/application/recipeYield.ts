import {
  normalizeRecipeVersionYield,
  requireRecipeYieldFactor,
  requireServingQuantity,
  type RecipeVersionYield,
  type RecipeVersionYieldInput
} from "../domain/recipeYield";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function upsertRecipeVersionYields(
  input: RecipeVersionYieldInput
): Promise<RecipeVersionYield> {
  const restaurantId = input.restaurantId?.trim() ?? "";
  const menuItemId = input.menuItemId?.trim() ?? "";
  if (!restaurantId) throw new Error("Missing restaurant workspace.");
  if (!menuItemId) throw new Error("Missing menu item.");
  return repository.upsertRecipeVersionYields({
    restaurantId,
    menuItemId,
    servingQuantity: requireServingQuantity(input.servingQuantity),
    prepYield: requireRecipeYieldFactor(input.prepYield),
    cookingYield: requireRecipeYieldFactor(input.cookingYield),
    recipeVersionId: input.recipeVersionId?.trim() || null
  });
}

export async function verifyRecipeVersionYields(
  restaurantId: string,
  recipeVersionId: string
): Promise<RecipeVersionYield> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedVersionId = recipeVersionId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedVersionId) throw new Error("Missing recipe version.");
  return repository.verifyRecipeVersionYields(normalizedRestaurantId, normalizedVersionId);
}

export async function retireRecipeVersionYields(
  restaurantId: string,
  recipeVersionId: string
): Promise<RecipeVersionYield> {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedVersionId = recipeVersionId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedVersionId) throw new Error("Missing recipe version.");
  return repository.retireRecipeVersionYields(normalizedRestaurantId, normalizedVersionId);
}

export { normalizeRecipeVersionYield };
