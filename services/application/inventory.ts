import type { InventoryItemPatch } from "../../types/mise";
import {
  buildInventoryControlSummary,
  buildInventoryOutlooks,
  buildRecipeBaselineSummary,
  recommendationReason,
  shouldSuppressRecommendationForItem
} from "../domain/miseDomain";
import {
  applyCountApprovalsToInventory,
  planCountSessionApprovals,
  summarizeCountSessionProgress
} from "../domain/inventoryCountSessions";
import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
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
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const existing = data.menuItemIngredients.find((mapping) => mapping.id === mappingId);
  if (!existing) throw new Error("Recipe baseline mapping not found");
  const planningMappings = data.menuItemIngredients.map((mapping) =>
    mapping.id === mappingId ? { ...mapping, quantity_used_per_sale: normalizedQuantity } : mapping
  );
  const recommendations = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    recommendationHistory,
    data.operatingDate
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate
  );
  return repository.saveRecipeMappingAndSignals({
    restaurantId,
    mappingId: existing.id,
    menuItemName: existing.menu_item_name,
    inventoryItemId: existing.inventory_item_id,
    quantityUsedPerSale: normalizedQuantity,
    unit: existing.unit,
    expectedQuantity: existing.quantity_used_per_sale,
    recommendations,
    insights
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

  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const inventoryItem = data.inventoryItems.find((item) => item.id === inventoryItemId);
  if (!inventoryItem) {
    throw new Error("Inventory item not found");
  }
  if (!inventoryUnitsAreCompatible(inventoryItem.unit, unit)) {
    throw new Error(`Recipe unit must match the inventory unit (${inventoryItem.unit}).`);
  }
  const existing = data.menuItemIngredients.find(
    (mapping) =>
      mapping.inventory_item_id === inventoryItemId &&
      mapping.menu_item_name.trim().toLowerCase() === menuItemName.toLowerCase()
  );
  const planningMapping = existing
    ? { ...existing, menu_item_name: menuItemName, quantity_used_per_sale: quantityUsedPerSale, unit }
    : {
        id: `pending_mapping_${inventoryItemId}`,
        restaurant_id: restaurantId,
        menu_item_name: menuItemName,
        inventory_item_id: inventoryItemId,
        quantity_used_per_sale: quantityUsedPerSale,
        unit
      };
  const planningMappings = existing
    ? data.menuItemIngredients.map((mapping) => mapping.id === existing.id ? planningMapping : mapping)
    : [...data.menuItemIngredients, planningMapping];
  const recommendations = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    recommendationHistory,
    data.operatingDate
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate
  );
  return repository.saveRecipeMappingAndSignals({
    restaurantId,
    mappingId: existing?.id ?? null,
    menuItemName,
    inventoryItemId,
    quantityUsedPerSale,
    unit,
    expectedQuantity: existing?.quantity_used_per_sale ?? null,
    recommendations,
    insights
  });
}

export async function deleteRecipeBaselineIngredient(restaurantId: string, mappingId: string) {
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const existing = data.menuItemIngredients.find((mapping) => mapping.id === mappingId);
  if (!existing) throw new Error("Recipe baseline mapping not found");
  const planningMappings = data.menuItemIngredients.filter((mapping) => mapping.id !== mappingId);
  const recommendations = buildRecommendationInserts(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    recommendationHistory,
    data.operatingDate
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate
  );
  await repository.deleteRecipeMappingAndSignals({
    restaurantId,
    mappingId: existing.id,
    recommendations,
    insights
  });
}

export async function addInventoryItemToOrder(restaurantId: string, itemId: string) {
  const existing = await repository.findPendingRecommendation(restaurantId, itemId);
  if (existing) return existing;

  const { item, prediction } = await fetchInventoryItemOutlook(restaurantId, itemId);
  const history = await repository.fetchRecommendationHistory(restaurantId);
  if (shouldSuppressRecommendationForItem(restaurantId, item, history)) {
    throw new Error("Update the inventory count first. This item was already handled.");
  }
  return repository.createPurchaseRecommendation({
    restaurant_id: restaurantId,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_name: item.supplier_name,
    recommended_quantity: prediction.suggestedOrderQuantity,
    unit: item.unit,
    reason: recommendationReason(item, prediction),
    urgency: prediction.urgency,
    status: "pending",
    supplier_order_id: null
  });
}

export async function updateInventoryItem(restaurantId: string, itemId: string, patch: InventoryItemPatch) {
  const normalizedPatch = requireInventoryItemPatch(patch);
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const existing = data.inventoryItems.find((item) => item.id === itemId);
  if (!existing) throw new Error("Inventory item not found");
  const updatedForPlanning = {
    ...existing,
    ...normalizedPatch,
    last_updated: new Date().toISOString()
  };
  const planningInventory = data.inventoryItems.map((item) => item.id === itemId ? updatedForPlanning : item);
  const recommendations = buildRecommendationInserts(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate
  );
  return repository.updateInventoryItemAndSignals(
    restaurantId,
    itemId,
    existing.last_updated,
    normalizedPatch,
    recommendations,
    insights
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
  const [detail, data, recommendationHistory] = await Promise.all([
    repository.fetchInventoryCountSession(restaurantId, sessionId),
    repository.fetchPlanningData(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  if (detail.session.status !== "submitted") {
    throw new Error("Submit the count session before approving adjustments.");
  }
  const progress = summarizeCountSessionProgress(detail.lines);
  if (!progress.canApprove) {
    throw new Error("Count every item before approving the session.");
  }
  const approvals = planCountSessionApprovals({
    inventoryItems: data.inventoryItems,
    lines: detail.lines
  });
  const planningInventory = applyCountApprovalsToInventory(
    data.inventoryItems,
    approvals,
    new Date().toISOString()
  );
  const recommendations = buildRecommendationInserts(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate
  );
  return repository.approveInventoryCountSession(
    restaurantId,
    sessionId,
    recommendations,
    insights
  );
}
