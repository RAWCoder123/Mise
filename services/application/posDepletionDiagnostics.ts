import {
  assertPosDepletionDiagnosticsTenantScoped,
  buildPosDepletionDiagnostics,
  type PosDepletionDiagnostics
} from "../domain/posDepletionDiagnostics";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchPosDepletionDiagnostics(
  restaurantId: string
): Promise<PosDepletionDiagnostics> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");

  const data = await repository.fetchPlanningData(normalizedRestaurantId);
  const diagnostics = buildPosDepletionDiagnostics({
    restaurantId: normalizedRestaurantId,
    operatingDate: data.operatingDate,
    sales: data.sales,
    mappings: data.menuItemIngredients,
    inventoryItems: data.inventoryItems,
    providerMappings: data.providerMappings
  });
  assertPosDepletionDiagnosticsTenantScoped(diagnostics, normalizedRestaurantId);
  return diagnostics;
}

export type { PosDepletionDiagnostics };
