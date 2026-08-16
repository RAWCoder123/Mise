import type { InventoryItemPatch } from "../../types/mise";
import {
  buildInventoryControlSummary,
  buildInventoryOutlooks,
  buildRecipeBaselineSummary
} from "../domain/miseDomain";
import {
  summarizeCountSessionProgress
} from "../domain/inventoryCountSessions";
import { buildRecommendationInserts } from "../domain/operationalSignals";
import {
  requireInventoryCountLineUpdates,
  requireInventoryCountSessionNote,
  requireInventoryItemPatch,
  requireRecipeBaselineQuantity
} from "../miseValidation";
import { inventoryUnitsAreCompatible } from "../domain/inventoryUnits";
import { demandFallbackForRestaurant } from "../demoData";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function fetchInventoryItems(restaurantId: string) {
  return repository.fetchInventoryItems(restaurantId);
}

export async function fetchInventoryOutlookItems(restaurantId: string) {
  const data = await repository.fetchPlanningData(restaurantId);
  return buildInventoryOutlooks(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    demandFallbackForRestaurant(restaurantId)
  );
}

export function summarizeInventoryOutlooks(
  restaurantId: string,
  outlooks: Awaited<ReturnType<typeof fetchInventoryOutlookItems>>
) {
  return buildInventoryControlSummary(restaurantId, outlooks);
}

export async function fetchInventoryItemOutlook(restaurantId: string, itemId: string) {
  const outlooks = await fetchInventoryOutlookItems(restaurantId);
  const outlook = outlooks.find(({ item }) => item.id === itemId);
  if (!outlook) throw new Error("Inventory item not found");
  return outlook;
}

export async function fetchRecipeBaselineSummary(restaurantId: string) {
  const data = await repository.fetchPlanningData(restaurantId);
  return buildRecipeBaselineSummary(
    restaurantId,
    data.sales,
    data.menuItemIngredients,
    data.inventoryItems,
    data.operatingDate
  );
}

export async function updateRecipeBaselineIngredient(
  restaurantId: string,
  mappingId: string,
  quantityUsedPerSale: number
) {
  const normalizedQuantity = requireRecipeBaselineQuantity(quantityUsedPerSale);
  const mappings = await repository.fetchMenuItemIngredients(restaurantId);
  const existing = mappings.find((mapping) => mapping.id === mappingId);
  if (!existing) throw new Error("Recipe baseline mapping not found");
  return repository.saveRecipeMappingAndSignals({
    restaurantId,
    mappingId: existing.id,
    menuItemName: existing.menu_item_name,
    inventoryItemId: existing.inventory_item_id,
    quantityUsedPerSale: normalizedQuantity,
    unit: existing.unit,
    expectedQuantity: existing.quantity_used_per_sale
  });
}

export async function addRecipeBaselineIngredient(
  restaurantId: string,
  input: {
    menuItemName: string;
    inventoryItemId: string;
    quantityUsedPerSale: number;
    unit: string;
  }
) {
  const menuItemName = input.menuItemName.trim();
  const inventoryItemId = input.inventoryItemId.trim();
  const unit = input.unit.trim();
  const quantityUsedPerSale = requireRecipeBaselineQuantity(input.quantityUsedPerSale);

  if (!menuItemName) throw new Error("Enter the POS menu item name.");
  if (!inventoryItemId) throw new Error("Choose an inventory item.");
  if (!unit) throw new Error("Inventory unit is required.");

  const [inventoryItems, mappings] = await Promise.all([
    repository.fetchInventoryItems(restaurantId),
    repository.fetchMenuItemIngredients(restaurantId)
  ]);
  const inventoryItem = inventoryItems.find((item) => item.id === inventoryItemId);
  if (!inventoryItem) {
    throw new Error("Inventory item not found");
  }
  if (!inventoryUnitsAreCompatible(inventoryItem.unit, unit)) {
    throw new Error(`Recipe unit must match the inventory unit (${inventoryItem.unit}).`);
  }
  const existing = mappings.find(
    (mapping) =>
      mapping.inventory_item_id === inventoryItemId &&
      mapping.menu_item_name.trim().toLowerCase() === menuItemName.toLowerCase()
  );
  return repository.saveRecipeMappingAndSignals({
    restaurantId,
    mappingId: existing?.id ?? null,
    menuItemName,
    inventoryItemId,
    quantityUsedPerSale,
    unit,
    expectedQuantity: existing?.quantity_used_per_sale ?? null
  });
}

export async function addInventoryItemToOrder(restaurantId: string, itemId: string) {
  const existing = await repository.findPendingRecommendation(restaurantId, itemId);
  if (existing) return existing;

  const [data, history] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const recommendation = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    data.menuItemIngredients,
    history,
    data.operatingDate,
    planningContext(data)
  ).find((entry) => entry.inventory_item_id === itemId);
  if (!recommendation) {
    throw new Error("Complete a fresh count and verify the sales-to-recipe evidence before ordering.");
  }
  return repository.createPurchaseRecommendation(recommendation);
}

export async function updateInventoryItem(restaurantId: string, itemId: string, patch: InventoryItemPatch) {
  const normalizedPatch = requireInventoryItemPatch(patch);
  const inventoryItems = await repository.fetchInventoryItems(restaurantId);
  const existing = inventoryItems.find((item) => item.id === itemId);
  if (!existing) throw new Error("Inventory item not found");
  return repository.updateInventoryItemAndSignals(
    restaurantId,
    itemId,
    existing.last_updated,
    normalizedPatch
  );
}

export async function fetchOpenInventoryCountSession(restaurantId: string) {
  return repository.fetchOpenInventoryCountSession(restaurantId);
}

export async function beginInventoryCountSession(restaurantId: string, note?: string | null) {
  const normalizedNote = requireInventoryCountSessionNote(note);
  return repository.beginInventoryCountSession(restaurantId, normalizedNote);
}

export async function saveInventoryCountLines(
  restaurantId: string,
  sessionId: string,
  lines: unknown
) {
  const normalizedLines = requireInventoryCountLineUpdates(lines);
  return repository.saveInventoryCountLines(restaurantId, sessionId, normalizedLines);
}

export async function submitInventoryCountSession(restaurantId: string, sessionId: string) {
  return repository.submitInventoryCountSession(restaurantId, sessionId);
}

export async function cancelInventoryCountSession(restaurantId: string, sessionId: string) {
  return repository.cancelInventoryCountSession(restaurantId, sessionId);
}

export async function approveInventoryCountSession(restaurantId: string, sessionId: string) {
  const detail = await repository.fetchInventoryCountSession(restaurantId, sessionId);
  if (detail.session.status !== "submitted") {
    throw new Error("Submit the count session before approving adjustments.");
  }
  const progress = summarizeCountSessionProgress(detail.lines);
  if (!progress.canApprove) {
    throw new Error("Count every item before approving the session.");
  }
  return repository.approveInventoryCountSession(restaurantId, sessionId);
}

function planningContext(data: Awaited<ReturnType<typeof repository.fetchPlanningData>>) {
  return {
    inventoryEvents: data.inventoryEvents,
    verifiedRecipeMappings: data.verifiedRecipeMappings,
    planningMode: data.planningMode,
    selectedPosLocationId: data.selectedPosLocationId,
    planningRevision: data.planningRevision,
    generatedAt: data.generatedAt,
    correlationId: data.correlationId
  };
}
