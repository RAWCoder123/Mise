import type { InventoryItemCreateInput, InventoryItemPatch } from "../../types/mise";
import {
  buildInventoryControlSummary,
  buildInventoryOutlooks,
  buildRecipeBaselineSummary,
  recommendationReason,
  shouldSuppressRecommendationForItem
} from "../domain/miseDomain";
import { planInventoryWaste } from "../domain/inventoryWaste";
import {
  assertInventoryItemCreateCapacity,
  findDuplicateInventoryItemName,
  planInventoryItemCreate
} from "../domain/inventoryItemCreate";
import {
  applyCountApprovalsToInventory,
  planCountSessionApprovals,
  summarizeCountSessionProgress
} from "../domain/inventoryCountSessions";
import { buildInsightsFromData, buildRecommendationInserts } from "../domain/operationalSignals";
import {
  requireInventoryCountLineUpdates,
  requireInventoryCountSessionNote,
  requireInventoryItemCreateInput,
  requireInventoryItemPatch,
  requireInventoryWasteNote,
  requireInventoryWasteQuantity,
  requireRecipeBaselineQuantity
} from "../miseValidation";
import { inventoryUnitsAreCompatible } from "../domain/inventoryUnits";
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
    data.appliedTodayConsumptionByItemId
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
    repository.fetchPurchaseRecommendations(restaurantId, "all")
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
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
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
    repository.fetchPurchaseRecommendations(restaurantId, "all")
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
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
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
    repository.fetchPurchaseRecommendations(restaurantId, "all")
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
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
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
  const history = await repository.fetchPurchaseRecommendations(restaurantId, "all");
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

export async function createInventoryItem(restaurantId: string, input: InventoryItemCreateInput) {
  const normalized = requireInventoryItemCreateInput(input);
  const planned = planInventoryItemCreate(normalized);
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchPurchaseRecommendations(restaurantId, "all")
  ]);
  assertInventoryItemCreateCapacity(data.inventoryItems.length);
  const duplicate = findDuplicateInventoryItemName(
    data.inventoryItems.map((item) => item.item_name),
    planned.item_name
  );
  if (duplicate) {
    throw new Error(`An inventory item named "${duplicate}" already exists.`);
  }

  const createdForPlanning = {
    id: `pending_inventory_${planned.item_name}`,
    restaurant_id: restaurantId,
    item_name: planned.item_name,
    category: planned.category,
    unit: planned.unit,
    current_quantity: planned.current_quantity,
    par_level: planned.par_level,
    reorder_threshold: planned.reorder_threshold,
    estimated_unit_cost: planned.estimated_unit_cost,
    supplier_name: planned.supplier_name,
    last_updated: new Date().toISOString()
  };
  const planningInventory = [...data.inventoryItems, createdForPlanning];
  const recommendations = buildRecommendationInserts(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  return repository.createInventoryItemAndSignals(
    restaurantId,
    {
      item_name: planned.item_name,
      category: planned.category,
      unit: planned.unit,
      current_quantity: planned.current_quantity,
      par_level: planned.par_level,
      reorder_threshold: planned.reorder_threshold,
      estimated_unit_cost: planned.estimated_unit_cost,
      supplier_name: planned.supplier_name
    },
    recommendations,
    insights
  );
}

export async function updateInventoryItem(restaurantId: string, itemId: string, patch: InventoryItemPatch) {
  const normalizedPatch = requireInventoryItemPatch(patch);
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchPurchaseRecommendations(restaurantId, "all")
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
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
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

export async function fetchInventoryMovements(restaurantId: string, itemId: string, limit = 8) {
  return repository.fetchInventoryMovements(restaurantId, itemId, limit);
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
    repository.fetchPurchaseRecommendations(restaurantId, "all")
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
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  return repository.approveInventoryCountSession(
    restaurantId,
    sessionId,
    recommendations,
    insights
  );
}

export async function recordInventoryWaste(
  restaurantId: string,
  itemId: string,
  quantityRemoved: number,
  note?: string | null
) {
  const normalizedQuantity = requireInventoryWasteQuantity(quantityRemoved);
  const normalizedNote = requireInventoryWasteNote(note);
  const [data, recommendationHistory] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    repository.fetchPurchaseRecommendations(restaurantId, "all")
  ]);
  const existing = data.inventoryItems.find((item) => item.id === itemId);
  if (!existing) throw new Error("Inventory item not found");
  if (existing.current_quantity <= 0) {
    throw new Error("Nothing on hand to record as waste. Update the count first.");
  }

  const planned = planInventoryWaste({
    quantityBefore: existing.current_quantity,
    quantityRemoved: normalizedQuantity,
    note: normalizedNote
  });
  const updatedForPlanning = {
    ...existing,
    current_quantity: planned.quantityAfter,
    last_updated: new Date().toISOString()
  };
  const planningInventory = data.inventoryItems.map((item) =>
    item.id === itemId ? updatedForPlanning : item
  );
  const recommendations = buildRecommendationInserts(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    data.appliedTodayConsumptionByItemId
  );
  return repository.recordInventoryWasteAndSignals(
    restaurantId,
    itemId,
    existing.last_updated,
    planned.quantityRemovedRequested,
    normalizedNote,
    recommendations,
    insights
  );
}
