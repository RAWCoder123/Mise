import {
  resolveSetupRecipeIngredientMapping,
  setupImportLimits,
  type SetupAttachmentDraft,
  type SetupInventoryDraftItem,
  type SetupPersistenceSummary,
  type SetupPosSaleDraft,
  type SetupRecipeDraft,
  type SetupSupplierDraft
} from "../domain/setupDrafts";
import {
  normalizeRecipeBaselineQuantity,
  normalizeRecommendedQuantity,
  operatingLimits,
  requireSupplierDisplayName
} from "../miseValidation";
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

  const suppliersByReference = new Map<
    string,
    {
      restaurant_id: string;
      client_reference_id: string;
      display_name: string;
      email: string | null;
    }
  >();
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
      supplier_client_reference_id: string;
    }
  >();

  for (const supplier of input.suppliers) {
    if (!supplier.name.trim() && !supplier.email.trim()) continue;
    const supplierReferenceId = requireSetupReferenceId(supplier.id, "supplier");
    const displayName = requireSupplierDisplayName(supplier.name);
    suppliersByReference.set(supplierReferenceId, {
      restaurant_id: normalizedRestaurantId,
      client_reference_id: supplierReferenceId,
      display_name: displayName,
      email: normalizeOptionalEmail(supplier.email)
    });
  }

  for (const draft of input.inventoryItems) {
    const itemName = draft.name.trim();
    if (!itemName) continue;
    const currentQuantity = normalizeRecommendedQuantity(draft.quantity);
    const parLevel = normalizeRecommendedQuantity(draft.parLevel || currentQuantity);
    const unit = draft.unit.trim() || "unit";
    const supplierReferenceId = requireSetupReferenceId(draft.supplierId, "supplier");
    if (!suppliersByReference.has(supplierReferenceId)) {
      throw new Error(`${itemName} references an unavailable supplier.`);
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
      supplier_client_reference_id: supplierReferenceId
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
        const supplierReferenceId = firstSupplierReferenceId(suppliersByReference);
        if (!supplierReferenceId) {
          skippedRecipeIngredients += 1;
          continue;
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
          supplier_client_reference_id: supplierReferenceId
        });
      }

      const linkedInventoryItem = inventoryItemsByName.get(ingredientName.toLowerCase());
      if (!linkedInventoryItem) {
        skippedRecipeIngredients += 1;
        continue;
      }

      const resolved = resolveSetupRecipeIngredientMapping({
        quantityUsedPerSale,
        recipeUnit: unit,
        inventoryUnit: linkedInventoryItem.unit
      });
      if (resolved.status !== "mapped") {
        skippedRecipeIngredients += 1;
        continue;
      }

      recipeMappings.push({
        menu_item_name: menuItemName,
        inventory_item_name: ingredientName,
        quantity_used_per_sale: resolved.quantityUsedPerSale,
        unit: resolved.unit
      });
    }
  }

  const summary = await repository.saveRestaurantSetupSnapshot(normalizedRestaurantId, {
    inventoryItems: [...inventoryItemsByName.values()],
    suppliers: [...suppliersByReference.values()],
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

  await regenerateOperationalSignals(normalizedRestaurantId);
  return summary;
}

function validateSetupInput(input: SaveRestaurantSetupInput) {
  const supplierReferences = new Set<string>();
  const normalizedSupplierNames = new Set<string>();
  input.suppliers.forEach((supplier) => {
    const hasDraftData = Boolean(supplier.name.trim() || supplier.email.trim());
    if (!hasDraftData) return;
    const supplierReferenceId = requireSetupReferenceId(supplier.id, "supplier");
    if (supplierReferences.has(supplierReferenceId)) {
      throw new Error("Setup contains a duplicate supplier reference.");
    }
    supplierReferences.add(supplierReferenceId);
    const displayName = requireSupplierDisplayName(supplier.name);
    const normalizedName = displayName.toLocaleLowerCase("en-US");
    if (normalizedSupplierNames.has(normalizedName)) {
      throw new Error(`Setup contains a duplicate supplier named ${displayName}.`);
    }
    normalizedSupplierNames.add(normalizedName);
    normalizeOptionalEmail(supplier.email);
  });

  input.inventoryItems.forEach((item) => {
    const hasDraftData = Boolean(
      item.name.trim() || item.quantity.trim() || item.parLevel.trim() || item.supplierId.trim()
    );
    if (!hasDraftData) return;
    const supplierReferenceId = requireSetupReferenceId(item.supplierId, "supplier");
    if (!supplierReferences.has(supplierReferenceId)) {
      throw new Error(`${item.name.trim() || "Inventory item"} requires a configured supplier.`);
    }
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
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid supplier email address.");
  }
  return normalized;
}

function requireSetupReferenceId(value: unknown, label: string) {
  const referenceId = typeof value === "string" ? value.trim() : "";
  if (
    !referenceId ||
    referenceId.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(referenceId)
  ) {
    throw new Error(`Setup ${label} reference is invalid.`);
  }
  return referenceId;
}

function firstSupplierReferenceId(
  suppliers: ReadonlyMap<string, { client_reference_id: string }>
) {
  return suppliers.values().next().value?.client_reference_id ?? null;
}
