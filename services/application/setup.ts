import { setupImportLimits } from "../domain/setupDrafts";
import type {
  SetupAttachmentDraft,
  SetupInventoryDraftItem,
  SetupPersistenceSummary,
  SetupPosSaleDraft,
  SetupRecipeDraft,
  SetupSupplierDraft
} from "../domain/setupDrafts";
import {
  normalizeRecipeBaselineQuantity,
  normalizeRecommendedQuantity,
  operatingLimits
} from "../miseValidation";
import { inventoryUnitsAreCompatible } from "../domain/inventoryUnits";
import { regenerateOperationalSignals } from "./recalculations";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export interface SaveRestaurantSetupInput {
  inventoryItems: SetupInventoryDraftItem[];
  suppliers: SetupSupplierDraft[];
  recipes: SetupRecipeDraft[];
  posSales?: SetupPosSaleDraft[];
  attachments: SetupAttachmentDraft[];
}

export interface SaveRestaurantSetupSummary extends SetupPersistenceSummary {}

export async function saveRestaurantSetup(
  restaurantId: string,
  input: SaveRestaurantSetupInput
): Promise<SaveRestaurantSetupSummary> {
  const normalizedRestaurantId = restaurantId.trim();
  if (!normalizedRestaurantId) throw new Error("Missing restaurant workspace.");
  validateSetupInput(input);

  const supplierNames = new Map<string, { supplier_name: string; email: string | null }>();
  const inventoryItemsByName = new Map<
    string,
    {
      restaurant_id: string;
      item_name: string;
      category: string;
      unit: string;
      current_quantity: number;
      par_level: number;
      reorder_threshold: number;
      estimated_unit_cost: number;
      supplier_name: string;
    }
  >();

  for (const supplier of input.suppliers) {
    const supplierName = supplier.name.trim();
    if (!supplierName) continue;
    supplierNames.set(supplierName.toLowerCase(), {
      supplier_name: supplierName,
      email: normalizeOptionalEmail(supplier.email)
    });
  }

  for (const draft of input.inventoryItems) {
    const itemName = draft.name.trim();
    if (!itemName) continue;
    const currentQuantity = normalizeRecommendedQuantity(draft.quantity);
    const parLevel = normalizeRecommendedQuantity(draft.parLevel || currentQuantity);
    const unit = draft.unit.trim() || "unit";
    const supplierName = draft.supplier.trim() || firstSupplierName(supplierNames.values()) || "Supplier";
    if (!supplierNames.has(supplierName.toLowerCase())) {
      supplierNames.set(supplierName.toLowerCase(), { supplier_name: supplierName, email: null });
    }
    inventoryItemsByName.set(itemName.toLowerCase(), {
      restaurant_id: normalizedRestaurantId,
      item_name: itemName,
      category: "Setup baseline",
      unit,
      current_quantity: currentQuantity,
      par_level: parLevel,
      reorder_threshold: Math.max(0, Math.round(parLevel * 0.35 * 100) / 100),
      estimated_unit_cost: 0,
      supplier_name: supplierName
    });
  }

  const recipeMappings: Array<{
    menu_item_name: string;
    inventory_item_name: string;
    quantity_used_per_sale: number;
    unit: string;
  }> = [];
  let skippedRecipeIngredients = 0;
  for (const recipe of input.recipes) {
    const menuItemName = recipe.dishName.trim();
    if (!menuItemName) continue;
    for (const ingredient of recipe.ingredients) {
      const ingredientName = ingredient.itemName.trim();
      const unit = ingredient.unit.trim() || "unit";
      const quantityUsedPerSale = normalizeRecipeBaselineQuantity(ingredient.quantity);
      if (!ingredientName || quantityUsedPerSale <= 0) {
        skippedRecipeIngredients += 1;
        continue;
      }

      if (!inventoryItemsByName.has(ingredientName.toLowerCase())) {
        const supplierName = firstSupplierName(supplierNames.values()) || "Supplier";
        if (!supplierNames.has(supplierName.toLowerCase())) {
          supplierNames.set(supplierName.toLowerCase(), { supplier_name: supplierName, email: null });
        }
        inventoryItemsByName.set(ingredientName.toLowerCase(), {
          restaurant_id: normalizedRestaurantId,
          item_name: ingredientName,
          category: "Recipe baseline",
          unit,
          current_quantity: 0,
          par_level: 0,
          reorder_threshold: 0,
          estimated_unit_cost: 0,
          supplier_name: supplierName
        });
      }

      const linkedInventoryItem = inventoryItemsByName.get(ingredientName.toLowerCase());
      if (!linkedInventoryItem || !inventoryUnitsAreCompatible(linkedInventoryItem.unit, unit)) {
        skippedRecipeIngredients += 1;
        continue;
      }

      recipeMappings.push({
        menu_item_name: menuItemName,
        inventory_item_name: ingredientName,
        quantity_used_per_sale: quantityUsedPerSale,
        unit: linkedInventoryItem.unit
      });
    }
  }

  const summary = await repository.saveRestaurantSetupSnapshot(normalizedRestaurantId, {
    inventoryItems: [...inventoryItemsByName.values()],
    suppliers: [...supplierNames.values()].map((supplier) => ({
      restaurant_id: normalizedRestaurantId,
      ...supplier
    })),
    recipeMappings,
    posSales: (input.posSales ?? []).map((sale) => ({
      restaurant_id: normalizedRestaurantId,
      source_record_id: sale.id,
      sale_date: sale.saleDate,
      item_name: sale.itemName,
      category: sale.category,
      quantity_sold: sale.quantitySold,
      gross_sales: sale.grossSales,
      net_sales: Math.round(sale.grossSales * 0.93 * 100) / 100,
      source_pos: sale.sourcePos
    })),
    attachments: input.attachments.map((attachment) => ({
      client_reference_id: attachment.id,
      kind: attachment.kind,
      label: attachment.label.trim() || "Setup reference",
      status: attachment.status
    })),
    skippedRecipeIngredients
  });

  // Hosted save_setup already refreshes signals in Edge; a second refresh_signals can
  // fail after a successful write and surface as a false setup failure.
  if (!repository.workflowsRefreshOperationalSignals) {
    await regenerateOperationalSignals(normalizedRestaurantId);
  }
  return summary;
}

function validateSetupInput(input: SaveRestaurantSetupInput) {
  input.inventoryItems.forEach((item) => {
    assertBoundedSetupNumber(item.quantity, 0, operatingLimits.inventoryQuantity, `${item.name || "Inventory item"} quantity`);
    assertBoundedSetupNumber(
      item.parLevel || item.quantity,
      0,
      operatingLimits.inventoryQuantity,
      `${item.name || "Inventory item"} par level`
    );
  });
  input.recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      assertBoundedSetupNumber(
        ingredient.quantity,
        0,
        operatingLimits.recipeQuantityPerSale,
        `${ingredient.itemName || "Recipe ingredient"} quantity per sale`
      );
    });
  });
  const sales = input.posSales ?? [];
  if (sales.length > setupImportLimits.rows) {
    throw new Error(`POS import is limited to ${setupImportLimits.rows.toLocaleString()} rows.`);
  }
  sales.forEach((sale) => {
    assertBoundedSetupNumber(sale.quantitySold, Number.EPSILON, operatingLimits.posQuantitySold, "POS quantity sold");
    assertBoundedSetupNumber(sale.grossSales, 0, operatingLimits.posSalesAmount, "POS gross sales");
  });
}

function assertBoundedSetupNumber(value: unknown, minimum: number, maximum: number, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum.toLocaleString()}.`);
  }
}

function normalizeOptionalEmail(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function firstSupplierName(suppliers: IterableIterator<{ supplier_name: string }>) {
  return suppliers.next().value?.supplier_name;
}
