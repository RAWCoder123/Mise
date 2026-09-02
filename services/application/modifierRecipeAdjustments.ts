import type { InventoryItem, RecipeBaselineItem } from "../../types/mise";
import {
  applyVerifiedModifierDeltas,
  isVerifiedModifierAdjustment,
  listVerifiedModifierAdjustmentsForVersion,
  normalizeModifierRecipeAdjustment,
  presentModifierQuantityDelta,
  requireExternalModifierId,
  requireModifierCanonicalUnit,
  requireModifierName,
  requireModifierQuantityDelta,
  type ModifierRecipeAdjustment,
  type ModifierRecipeAdjustmentInput,
  type ModifierRecipeAdjustmentListItem
} from "../domain/modifierRecipeAdjustments";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function listModifierRecipeAdjustments(
  restaurantId: string
): Promise<ModifierRecipeAdjustmentListItem[]> {
  const [adjustments, inventoryItems, versionMenuById] = await Promise.all([
    repository.listModifierRecipeAdjustments(restaurantId),
    repository.fetchInventoryItems(restaurantId),
    repository.listModifierAdjustmentMenuContexts(restaurantId)
  ]);

  const inventoryNames = new Map(
    inventoryItems
      .filter((item) => item.restaurant_id === restaurantId)
      .map((item) => [item.id, item.item_name] as const)
  );

  return adjustments
    .filter((entry) => entry.restaurantId === restaurantId)
    .map((entry) => {
      const context = versionMenuById.get(entry.recipeVersionId);
      return {
        ...entry,
        menuItemId: context?.menuItemId ?? null,
        menuItemName: context?.menuItemName ?? entry.recipeVersionId,
        inventoryItemName:
          inventoryNames.get(entry.inventoryItemId) ?? entry.inventoryItemId
      };
    })
    .sort((left, right) => {
      const statusRank =
        statusSortRank(left.verificationStatus) - statusSortRank(right.verificationStatus);
      if (statusRank !== 0) return statusRank;
      return (
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.menuItemName.localeCompare(right.menuItemName) ||
        left.modifierName.localeCompare(right.modifierName) ||
        left.id.localeCompare(right.id)
      );
    });
}

export async function upsertModifierRecipeAdjustment(
  input: ModifierRecipeAdjustmentInput
): Promise<ModifierRecipeAdjustment> {
  const restaurantId = input.restaurantId?.trim() ?? "";
  const menuItemId = input.menuItemId?.trim() ?? "";
  const inventoryItemId = input.inventoryItemId?.trim() ?? "";
  if (!restaurantId) throw new Error("Missing restaurant workspace.");
  if (!menuItemId) throw new Error("Missing menu item.");
  if (!inventoryItemId) throw new Error("Missing inventory item.");
  return repository.upsertModifierRecipeAdjustment({
    restaurantId,
    menuItemId,
    externalModifierId: requireExternalModifierId(input.externalModifierId),
    modifierName: requireModifierName(input.modifierName),
    inventoryItemId,
    quantityDelta: requireModifierQuantityDelta(input.quantityDelta),
    canonicalUnit: requireModifierCanonicalUnit(input.canonicalUnit),
    adjustmentId: input.adjustmentId?.trim() || null
  });
}

export async function verifyModifierRecipeAdjustment(
  restaurantId: string,
  adjustmentId: string
): Promise<ModifierRecipeAdjustment> {
  return repository.verifyModifierRecipeAdjustment(restaurantId, adjustmentId);
}

export async function rejectModifierRecipeAdjustment(
  restaurantId: string,
  adjustmentId: string
): Promise<ModifierRecipeAdjustment> {
  return repository.rejectModifierRecipeAdjustment(restaurantId, adjustmentId);
}

export async function expireModifierRecipeAdjustment(
  restaurantId: string,
  adjustmentId: string
): Promise<ModifierRecipeAdjustment> {
  return repository.expireModifierRecipeAdjustment(restaurantId, adjustmentId);
}

export function modifierEligibleInventoryItems(
  inventoryItems: readonly InventoryItem[],
  restaurantId: string
): InventoryItem[] {
  return inventoryItems
    .filter(
      (item) =>
        item.restaurant_id === restaurantId &&
        item.canonical_unit_verification_status === "verified" &&
        (item.canonical_unit === "g" ||
          item.canonical_unit === "ml" ||
          item.canonical_unit === "each")
    )
    .sort(
      (left, right) =>
        left.item_name.localeCompare(right.item_name) || left.id.localeCompare(right.id)
    );
}

export function modifierEligibleMenuItems(
  items: readonly RecipeBaselineItem[]
): Array<{ menuItemId: string; menuItemName: string }> {
  const seen = new Set<string>();
  const out: Array<{ menuItemId: string; menuItemName: string }> = [];
  for (const item of items) {
    const menuItemId = item.menuItemId?.trim() ?? "";
    if (!menuItemId || seen.has(menuItemId)) continue;
    seen.add(menuItemId);
    out.push({ menuItemId, menuItemName: item.menu_item_name });
  }
  return out.sort(
    (left, right) =>
      left.menuItemName.localeCompare(right.menuItemName) ||
      left.menuItemId.localeCompare(right.menuItemId)
  );
}

export {
  applyVerifiedModifierDeltas,
  isVerifiedModifierAdjustment,
  listVerifiedModifierAdjustmentsForVersion,
  normalizeModifierRecipeAdjustment,
  presentModifierQuantityDelta
};

function statusSortRank(status: ModifierRecipeAdjustment["verificationStatus"]): number {
  switch (status) {
    case "draft":
      return 0;
    case "verified":
      return 1;
    case "rejected":
      return 2;
    case "expired":
      return 3;
    default:
      return 4;
  }
}
