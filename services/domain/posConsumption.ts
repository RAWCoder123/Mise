import { inventoryUnitsAreCompatible } from "./inventoryUnits";

export type RecipeConsumptionSaleInput = {
  id: string;
  restaurant_id: string;
  source_record_id?: string | null;
  sale_date: string;
  item_name: string;
  quantity_sold: number;
};

export type RecipeConsumptionMappingInput = {
  id: string;
  restaurant_id: string;
  menu_item_name: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
};

export type RecipeConsumptionInventoryInput = {
  id: string;
  restaurant_id: string;
  unit: string;
  current_quantity: number;
};

export type RecipeConsumptionLine = {
  inventoryItemId: string;
  restaurantId: string;
  quantityUsed: number;
  menuItemName: string;
  mappingId: string;
  posSaleId: string;
  sourceRecordId: string;
  saleDate: string;
  unit: string;
};

export type RecipeConsumptionPlan = {
  lines: RecipeConsumptionLine[];
  itemDeltas: Map<string, number>;
  unmappedSales: Array<{ saleId: string; itemName: string; quantitySold: number }>;
  skippedIncompatible: Array<{
    saleId: string;
    mappingId: string;
    menuItemName: string;
    inventoryItemId: string;
  }>;
};

export type AppliedConsumptionMovement = {
  reason: string;
  inventory_item_id: string;
  quantity_before: number;
  quantity_after: number;
  metadata?: Record<string, unknown> | null;
};

function normalizeMenuItemKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function finiteNonNegative(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function roundQuantity(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function buildRecipeConsumptionPlan(input: {
  restaurantId: string;
  sales: RecipeConsumptionSaleInput[];
  mappings: RecipeConsumptionMappingInput[];
  inventoryItems: RecipeConsumptionInventoryInput[];
}): RecipeConsumptionPlan {
  const restaurantId = input.restaurantId;
  const inventoryById = new Map(
    input.inventoryItems
      .filter((item) => item.restaurant_id === restaurantId)
      .map((item) => [item.id, item])
  );
  const mappings = input.mappings.filter((mapping) => mapping.restaurant_id === restaurantId);
  const lines: RecipeConsumptionLine[] = [];
  const itemDeltas = new Map<string, number>();
  const unmappedSales: RecipeConsumptionPlan["unmappedSales"] = [];
  const skippedIncompatible: RecipeConsumptionPlan["skippedIncompatible"] = [];

  for (const sale of input.sales) {
    if (sale.restaurant_id !== restaurantId) continue;
    const sold = finiteNonNegative(sale.quantity_sold);
    if (sold <= 0) continue;
    const sourceRecordId = sale.source_record_id?.trim() ?? "";
    if (!sourceRecordId) continue;

    const saleKey = normalizeMenuItemKey(sale.item_name);
    const matched = mappings.filter(
      (mapping) => normalizeMenuItemKey(mapping.menu_item_name) === saleKey
    );
    if (matched.length === 0) {
      unmappedSales.push({
        saleId: sale.id,
        itemName: sale.item_name,
        quantitySold: sold
      });
      continue;
    }

    let wroteCompatible = false;
    for (const recipe of matched) {
      const inventoryItem = inventoryById.get(recipe.inventory_item_id);
      if (!inventoryItem || !inventoryUnitsAreCompatible(inventoryItem.unit, recipe.unit)) {
        skippedIncompatible.push({
          saleId: sale.id,
          mappingId: recipe.id,
          menuItemName: recipe.menu_item_name,
          inventoryItemId: recipe.inventory_item_id
        });
        continue;
      }
      const quantityUsed = roundQuantity(sold * finiteNonNegative(recipe.quantity_used_per_sale));
      if (quantityUsed <= 0) continue;
      wroteCompatible = true;
      lines.push({
        inventoryItemId: recipe.inventory_item_id,
        restaurantId,
        quantityUsed,
        menuItemName: recipe.menu_item_name,
        mappingId: recipe.id,
        posSaleId: sale.id,
        sourceRecordId,
        saleDate: sale.sale_date,
        unit: inventoryItem.unit
      });
      itemDeltas.set(
        recipe.inventory_item_id,
        roundQuantity((itemDeltas.get(recipe.inventory_item_id) ?? 0) + quantityUsed)
      );
    }
    if (!wroteCompatible && matched.length > 0) {
      unmappedSales.push({
        saleId: sale.id,
        itemName: sale.item_name,
        quantitySold: sold
      });
    }
  }

  return { lines, itemDeltas, unmappedSales, skippedIncompatible };
}

export function projectedQuantityAfterSales(
  currentQuantity: number,
  theoreticalTodayUsage: number,
  appliedTodayConsumption: number
) {
  const onHand = finiteNonNegative(currentQuantity);
  const theoretical = finiteNonNegative(theoreticalTodayUsage);
  const applied = Math.min(theoretical, finiteNonNegative(appliedTodayConsumption));
  const unappliedUsage = roundQuantity(Math.max(0, theoretical - applied));
  return {
    projectedQuantity: roundQuantity(Math.max(0, onHand - unappliedUsage)),
    unappliedUsage
  };
}

export function sumAppliedRecipeConsumption(
  movements: AppliedConsumptionMovement[],
  inventoryItemId: string,
  options?: { saleDate?: string; sourceRecordIds?: ReadonlySet<string> }
) {
  return roundQuantity(
    movements.reduce((sum, movement) => {
      if (movement.inventory_item_id !== inventoryItemId) return sum;
      if (movement.reason !== "recipe_consumption" && movement.reason !== "pos_consumption") {
        return sum;
      }
      const metadata = movement.metadata ?? {};
      if (options?.saleDate) {
        const saleDate = typeof metadata.sale_date === "string" ? metadata.sale_date : null;
        if (saleDate !== options.saleDate) return sum;
      }
      if (options?.sourceRecordIds) {
        const sourceRecordId =
          typeof metadata.source_record_id === "string" ? metadata.source_record_id : null;
        if (!sourceRecordId || !options.sourceRecordIds.has(sourceRecordId)) return sum;
      }
      const consumed = Math.max(0, movement.quantity_before - movement.quantity_after);
      return sum + consumed;
    }, 0)
  );
}

export function consumptionLineKey(line: Pick<RecipeConsumptionLine, "sourceRecordId" | "inventoryItemId">) {
  return `${line.sourceRecordId}\u001f${line.inventoryItemId}`;
}

export function hasAppliedConsumptionLine(
  movements: AppliedConsumptionMovement[],
  line: Pick<RecipeConsumptionLine, "sourceRecordId" | "inventoryItemId">
) {
  return movements.some((movement) => {
    if (movement.reason !== "recipe_consumption" && movement.reason !== "pos_consumption") {
      return false;
    }
    if (movement.inventory_item_id !== line.inventoryItemId) return false;
    const sourceRecordId =
      typeof movement.metadata?.source_record_id === "string"
        ? movement.metadata.source_record_id
        : null;
    return sourceRecordId === line.sourceRecordId;
  });
}

export const CONSUMED_POS_SALE_CORRECTION_ERROR =
  "This POS CSV row already drove inventory consumption. Correct stock with a count, waste, or manager adjustment instead of re-importing a changed sale.";

export type PosSaleConsumptionIdentity = {
  source_record_id: string;
  quantity_sold: number;
  item_name: string;
  category: string;
  sale_date: string;
};

export type ConsumedPosSaleCorrectionConflict = {
  sourceRecordId: string;
  field: "quantity_sold" | "item_name" | "sale_date" | "category" | "source_record_id" | "missing_original";
};

export function collectConsumedPosSourceRecordIds(
  movements: AppliedConsumptionMovement[]
): Set<string> {
  const ids = new Set<string>();
  for (const movement of movements) {
    if (movement.reason !== "recipe_consumption" && movement.reason !== "pos_consumption") {
      continue;
    }
    const sourceRecordId =
      typeof movement.metadata?.source_record_id === "string"
        ? movement.metadata.source_record_id.trim()
        : "";
    if (sourceRecordId) ids.add(sourceRecordId);
  }
  return ids;
}

function sameSaleDate(left: string, right: string) {
  return left.trim() === right.trim();
}

function sameSaleQuantity(left: number, right: number) {
  return roundQuantity(finiteNonNegative(left)) === roundQuantity(finiteNonNegative(right));
}

function normalizeCategoryKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function posSaleBusinessKey(sale: Pick<PosSaleConsumptionIdentity, "sale_date" | "item_name" | "category">) {
  return [
    sale.sale_date.trim(),
    normalizeMenuItemKey(sale.item_name),
    normalizeCategoryKey(sale.category)
  ].join("\u001f");
}

export function findConsumedPosSaleCorrectionConflicts(input: {
  incoming: PosSaleConsumptionIdentity[];
  existing: PosSaleConsumptionIdentity[];
  consumedSourceRecordIds: ReadonlySet<string>;
}): ConsumedPosSaleCorrectionConflict[] {
  if (input.consumedSourceRecordIds.size === 0) return [];

  const consumedExisting = input.existing.filter((sale) =>
    input.consumedSourceRecordIds.has(sale.source_record_id.trim())
  );
  if (consumedExisting.length === 0) return [];

  const existingBySource = new Map(
    consumedExisting.map((sale) => [sale.source_record_id.trim(), sale])
  );
  const existingByBusinessKey = new Map<string, PosSaleConsumptionIdentity[]>();
  for (const sale of consumedExisting) {
    const key = posSaleBusinessKey(sale);
    const group = existingByBusinessKey.get(key) ?? [];
    group.push(sale);
    existingByBusinessKey.set(key, group);
  }

  const conflicts: ConsumedPosSaleCorrectionConflict[] = [];
  const seen = new Set<string>();

  for (const sale of input.incoming) {
    const sourceRecordId = sale.source_record_id.trim();
    if (!sourceRecordId || seen.has(sourceRecordId)) continue;

    const sameSourceOriginal = existingBySource.get(sourceRecordId);
    if (sameSourceOriginal) {
      if (!sameSaleQuantity(sameSourceOriginal.quantity_sold, sale.quantity_sold)) {
        conflicts.push({ sourceRecordId, field: "quantity_sold" });
        seen.add(sourceRecordId);
        continue;
      }
      if (normalizeMenuItemKey(sameSourceOriginal.item_name) !== normalizeMenuItemKey(sale.item_name)) {
        conflicts.push({ sourceRecordId, field: "item_name" });
        seen.add(sourceRecordId);
        continue;
      }
      if (normalizeCategoryKey(sameSourceOriginal.category) !== normalizeCategoryKey(sale.category)) {
        conflicts.push({ sourceRecordId, field: "category" });
        seen.add(sourceRecordId);
        continue;
      }
      if (!sameSaleDate(sameSourceOriginal.sale_date, sale.sale_date)) {
        conflicts.push({ sourceRecordId, field: "sale_date" });
        seen.add(sourceRecordId);
      }
      continue;
    }

    const businessMatches = existingByBusinessKey.get(posSaleBusinessKey(sale)) ?? [];
    if (businessMatches.length === 0) continue;

    // CSV fingerprints include quantity, so corrections mint a new source_record_id.
    // Treat same-date/item/category rows that already consumed inventory as corrections.
    const quantityChanged = businessMatches.some(
      (original) => !sameSaleQuantity(original.quantity_sold, sale.quantity_sold)
    );
    conflicts.push({
      sourceRecordId,
      field: quantityChanged ? "quantity_sold" : "source_record_id"
    });
    seen.add(sourceRecordId);
  }

  return conflicts;
}

export function assertNoConsumedPosSaleCorrections(input: {
  incoming: PosSaleConsumptionIdentity[];
  existing: PosSaleConsumptionIdentity[];
  consumedSourceRecordIds: ReadonlySet<string>;
}) {
  const conflicts = findConsumedPosSaleCorrectionConflicts(input);
  if (conflicts.length > 0) {
    throw new Error(CONSUMED_POS_SALE_CORRECTION_ERROR);
  }
}

export function buildAppliedTodayConsumptionByItemId(
  movements: AppliedConsumptionMovement[],
  operatingDate: string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const movement of movements) {
    if (movement.reason !== "recipe_consumption" && movement.reason !== "pos_consumption") {
      continue;
    }
    const saleDate =
      typeof movement.metadata?.sale_date === "string" ? movement.metadata.sale_date : null;
    if (saleDate !== operatingDate) continue;
    const consumed = Math.max(0, movement.quantity_before - movement.quantity_after);
    if (consumed <= 0) continue;
    result[movement.inventory_item_id] = roundQuantity(
      (result[movement.inventory_item_id] ?? 0) + consumed
    );
  }
  return result;
}
