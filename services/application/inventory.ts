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
  requireRecipeBaselineQuantity,
  requireSupplierAuthorityId
} from "../miseValidation";
import { inventoryUnitsAreCompatible } from "../domain/inventoryUnits";
import {
  withPendingCountEvidence,
  type LedgerProjectionEvent
} from "../domain/inventoryCountAuthority";
import { demandFallbackForRestaurant } from "../demoData";
import {
  fetchInventoryLedgerEvidence,
  inventoryCountEvidenceFor
} from "./inventoryEvidence";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

/**
 * Planning data plus the authoritative physical-count evidence that anchors it.
 * Every planning read goes through here so no path can fall back to
 * `inventory_items.last_updated` as proof that a count happened.
 */
async function fetchAnchoredPlanningData(restaurantId: string) {
  const [data, ledger] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    fetchInventoryLedgerEvidence(restaurantId)
  ]);
  return {
    ...data,
    ledgerEvents: ledger.events,
    ledgerComplete: ledger.complete,
    countEvidence: inventoryCountEvidenceFor({
      restaurantId,
      inventoryItems: data.inventoryItems,
      ledgerEvents: ledger.events,
      ledgerComplete: ledger.complete,
      timeZone: data.timeZone
    })
  };
}

/** Count evidence in the shape the operational-signals snapshot accepts. */
function signalCountEvidence(data: {
  ledgerEvents: readonly LedgerProjectionEvent[];
  ledgerComplete: boolean;
  timeZone: string;
}) {
  return {
    inventoryLedgerEvents: data.ledgerEvents,
    ledgerComplete: data.ledgerComplete,
    timeZone: data.timeZone
  };
}

export async function fetchInventoryItems(restaurantId: string) {
  return repository.fetchInventoryItems(restaurantId);
}

export async function reassignInventoryItemSupplier(
  restaurantId: string,
  itemId: string,
  supplierId: string
) {
  const normalizedRestaurantId = requireSupplierAuthorityId(restaurantId, "restaurant");
  const normalizedItemId = requireSupplierAuthorityId(itemId, "inventory item");
  const normalizedSupplierId = requireSupplierAuthorityId(supplierId);
  return repository.reassignInventoryItemSupplier(
    normalizedRestaurantId,
    normalizedItemId,
    normalizedSupplierId
  );
}

/** Outlooks plus the count evidence that anchored them, for callers that need both. */
async function fetchAnchoredInventoryOutlooks(restaurantId: string) {
  const data = await fetchAnchoredPlanningData(restaurantId);
  return {
    countEvidence: data.countEvidence,
    outlooks: buildInventoryOutlooks(
      restaurantId,
      data.inventoryItems,
      data.sales,
      data.menuItemIngredients,
      data.operatingDate,
      demandFallbackForRestaurant(restaurantId),
      data.countEvidence,
      data.providerMappings
    )
  };
}

export async function fetchInventoryOutlookItems(restaurantId: string) {
  return (await fetchAnchoredInventoryOutlooks(restaurantId)).outlooks;
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
  const authorityRead = typeof repository.fetchRecipeAuthorities === "function"
    ? repository.fetchRecipeAuthorities(restaurantId)
    : Promise.resolve([]);
  const [data, authorities] = await Promise.all([
    repository.fetchPlanningData(restaurantId),
    authorityRead
  ]);
  const summary = buildRecipeBaselineSummary(
    restaurantId,
    data.sales,
    data.menuItemIngredients,
    data.inventoryItems,
    data.operatingDate,
    data.providerMappings
  );
  return {
    ...summary,
    items: summary.items.map((item) => {
      const mapping = data.menuItemIngredients.find((entry) =>
        entry.restaurant_id === restaurantId && entry.menu_item_name === item.menu_item_name
      );
      const authority = authorities.find((entry) =>
        entry.menuItemId === mapping?.menu_item_id
        || entry.menuItemName.trim().toLowerCase() === item.menu_item_name.trim().toLowerCase()
      );
      return {
        ...item,
        menuItemId: authority?.menuItemId ?? mapping?.menu_item_id ?? null,
        recipeRevision: authority?.recipeRevision ?? 0,
        confirmedRevision: authority?.confirmedRevision ?? null,
        confirmedAt: authority?.confirmedAt ?? null,
        authorityReady: authority?.ready ?? false
      };
    })
  };
}

export async function confirmRecipeBaselineComplete(
  restaurantId: string,
  menuItemId: string,
  expectedRevision: number
) {
  const normalizedRestaurantId = restaurantId.trim();
  const normalizedMenuItemId = menuItemId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  if (!normalizedMenuItemId) throw new Error("Missing menu item.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error("Recipe revision is invalid.");
  }
  return repository.confirmRecipeComplete(
    normalizedRestaurantId,
    normalizedMenuItemId,
    expectedRevision
  );
}

export async function updateRecipeBaselineIngredient(
  restaurantId: string,
  mappingId: string,
  quantityUsedPerSale: number
) {
  const normalizedQuantity = requireRecipeBaselineQuantity(quantityUsedPerSale);
  const [data, recommendationHistory] = await Promise.all([
    fetchAnchoredPlanningData(restaurantId),
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
    data.operatingDate,
    signalCountEvidence(data),
    data.providerMappings
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate,
    signalCountEvidence(data),
    data.providerMappings
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
    fetchAnchoredPlanningData(restaurantId),
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
    data.operatingDate,
    signalCountEvidence(data)
  );
  const insights = buildInsightsFromData(
    restaurantId,
    data.inventoryItems,
    data.sales,
    planningMappings,
    data.operatingDate,
    signalCountEvidence(data)
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

export async function addInventoryItemToOrder(restaurantId: string, itemId: string) {
  const existing = await repository.findPendingRecommendation(restaurantId, itemId);
  if (existing) return existing;

  const [anchored, history] = await Promise.all([
    fetchAnchoredInventoryOutlooks(restaurantId),
    repository.fetchRecommendationHistory(restaurantId)
  ]);
  const outlook = anchored.outlooks.find((entry) => entry.item.id === itemId);
  if (!outlook) throw new Error("Inventory item not found");
  const { item, prediction } = outlook;
  if (prediction.countEvidence === "contaminated_projection") {
    throw new Error(
      "Record a new physical count for this item first. Its on-hand number came from an invalid future-dated count."
    );
  }
  if (shouldSuppressRecommendationForItem(restaurantId, item, history, anchored.countEvidence)) {
    throw new Error("Update the inventory count first. This item was already handled.");
  }
  return repository.createPurchaseRecommendation({
    restaurant_id: restaurantId,
    inventory_item_id: item.id,
    item_name: item.item_name,
    supplier_id: item.supplier_id,
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
    fetchAnchoredPlanningData(restaurantId),
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
    data.operatingDate,
    signalCountEvidence(data),
    data.providerMappings
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    signalCountEvidence(data),
    data.providerMappings
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
    fetchAnchoredPlanningData(restaurantId),
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
  const countedAt = new Date().toISOString();
  const planningInventory = applyCountApprovalsToInventory(
    data.inventoryItems,
    approvals,
    countedAt
  );
  // The count events for this approval are not on the ledger yet, so the recomputed
  // signals must be anchored to the count being approved rather than the previous one.
  const pendingCountEvidence = signalCountEvidence({
    timeZone: data.timeZone,
    ledgerComplete: data.ledgerComplete,
    ledgerEvents: withPendingCountEvidence(data.ledgerEvents, {
      restaurantId,
      inventoryItemIds: approvals.map((approval) => approval.inventoryItemId),
      countedAt
    })
  });
  const recommendations = buildRecommendationInserts(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    recommendationHistory,
    data.operatingDate,
    pendingCountEvidence,
    data.providerMappings
  );
  const insights = buildInsightsFromData(
    restaurantId,
    planningInventory,
    data.sales,
    data.menuItemIngredients,
    data.operatingDate,
    pendingCountEvidence,
    data.providerMappings
  );
  return repository.approveInventoryCountSession(
    restaurantId,
    sessionId,
    recommendations,
    insights
  );
}
