import { inventoryItemNameKey } from "./inventoryItemCreate";
import {
  resolveInventoryItemForRecipeLink,
  searchInventoryItemsForPicker,
  type InventoryItemSearchFields
} from "./inventoryItemSearch";
import type { SetupInventoryDraftItem, SetupRecipeIngredientDraft } from "./setupDrafts";

export type SetupInventoryPickerItem = InventoryItemSearchFields & {
  draft: SetupInventoryDraftItem;
};

/**
 * Adapt setup inventory drafts into the shared recipe inventory picker shape.
 * Blank names are omitted so they cannot steal ambiguous matches.
 */
export function toSetupInventoryPickerItems(
  drafts: readonly SetupInventoryDraftItem[]
): SetupInventoryPickerItem[] {
  const items: SetupInventoryPickerItem[] = [];
  for (const draft of drafts) {
    const itemName = draft.name.trim();
    if (!itemName) continue;
    items.push({
      id: draft.id,
      item_name: itemName,
      category: "Setup baseline",
      supplier_name: draft.supplier.trim() || null,
      unit: draft.unit.trim() || "unit",
      draft
    });
  }
  return items;
}

export function searchSetupInventoryForPicker(
  drafts: readonly SetupInventoryDraftItem[],
  query: string,
  options?: { limit?: number }
) {
  return searchInventoryItemsForPicker(toSetupInventoryPickerItems(drafts), query, options);
}

/**
 * Resolve a setup recipe ingredient against onboarding inventory drafts.
 * Prefers an explicit draft id, then exact/unique ranked name matches.
 */
export function resolveSetupRecipeIngredient(
  drafts: readonly SetupInventoryDraftItem[],
  ingredient: Pick<SetupRecipeIngredientDraft, "itemName" | "inventoryItemId">
): SetupInventoryDraftItem | null {
  const pickerItems = toSetupInventoryPickerItems(drafts);
  const resolved = resolveInventoryItemForRecipeLink(
    pickerItems,
    ingredient.itemName,
    ingredient.inventoryItemId
  );
  return resolved?.draft ?? null;
}

/**
 * Resolve against an already-normalized inventory catalog (name-keyed rows).
 * Used during setup persistence after draft inventory is materialized.
 */
export function resolveSetupRecipeIngredientAgainstCatalog<T extends InventoryItemSearchFields>(
  catalog: readonly T[],
  ingredientName: string,
  selectedCatalogId?: string | null
): T | null {
  return resolveInventoryItemForRecipeLink(catalog, ingredientName, selectedCatalogId);
}

export function setupInventoryCatalogId(itemName: string) {
  return inventoryItemNameKey(itemName);
}
