import type { InventoryItem } from "../../types/mise";
import {
  convertSourceQuantityToSubstitute,
  isActiveVerifiedSubstitution,
  listActiveVerifiedSubstitutesForItem,
  normalizeIngredientSubstitution,
  presentIngredientSubstitutionRatio,
  requireSubstitutionCanonicalUnit,
  requireSubstitutionQuantity,
  type IngredientSubstitution,
  type IngredientSubstitutionInput,
  type IngredientSubstitutionListItem
} from "../domain/ingredientSubstitutions";
import { getMiseRepository } from "./repository";

const repository = getMiseRepository();

export async function listIngredientSubstitutions(
  restaurantId: string
): Promise<IngredientSubstitutionListItem[]> {
  const [substitutions, inventoryItems] = await Promise.all([
    repository.listIngredientSubstitutions(restaurantId),
    repository.fetchInventoryItems(restaurantId)
  ]);
  const names = new Map(
    inventoryItems
      .filter((item) => item.restaurant_id === restaurantId)
      .map((item) => [item.id, item.item_name] as const)
  );
  return substitutions
    .filter((entry) => entry.restaurantId === restaurantId)
    .map((entry) => ({
      ...entry,
      sourceItemName: names.get(entry.sourceInventoryItemId) ?? entry.sourceInventoryItemId,
      substituteItemName:
        names.get(entry.substituteInventoryItemId) ?? entry.substituteInventoryItemId
    }))
    .sort((left, right) => {
      const statusRank = statusSortRank(left.verificationStatus) - statusSortRank(right.verificationStatus);
      if (statusRank !== 0) return statusRank;
      return (
        right.updatedAt.localeCompare(left.updatedAt) ||
        left.sourceItemName.localeCompare(right.sourceItemName) ||
        left.id.localeCompare(right.id)
      );
    });
}

export async function listVerifiedSubstitutesForInventoryItem(
  restaurantId: string,
  inventoryItemId: string
): Promise<IngredientSubstitutionListItem[]> {
  const listed = await listIngredientSubstitutions(restaurantId);
  return listed.filter(
    (entry) =>
      entry.sourceInventoryItemId === inventoryItemId &&
      isActiveVerifiedSubstitution(entry)
  );
}

export async function upsertIngredientSubstitution(
  input: IngredientSubstitutionInput
): Promise<IngredientSubstitution> {
  const sourceQuantity = requireSubstitutionQuantity(input.sourceQuantity);
  const substituteQuantity = requireSubstitutionQuantity(input.substituteQuantity);
  const canonicalUnit = requireSubstitutionCanonicalUnit(input.canonicalUnit);
  if (
    !input.sourceInventoryItemId?.trim() ||
    !input.substituteInventoryItemId?.trim() ||
    input.sourceInventoryItemId === input.substituteInventoryItemId
  ) {
    throw new Error("Substitution items must be distinct inventory rows.");
  }
  return repository.upsertIngredientSubstitution({
    restaurantId: input.restaurantId,
    sourceInventoryItemId: input.sourceInventoryItemId,
    substituteInventoryItemId: input.substituteInventoryItemId,
    sourceQuantity,
    substituteQuantity,
    canonicalUnit,
    substitutionId: input.substitutionId ?? null
  });
}

export async function verifyIngredientSubstitution(
  restaurantId: string,
  substitutionId: string
): Promise<IngredientSubstitution> {
  return repository.verifyIngredientSubstitution(restaurantId, substitutionId);
}

export async function rejectIngredientSubstitution(
  restaurantId: string,
  substitutionId: string
): Promise<IngredientSubstitution> {
  return repository.rejectIngredientSubstitution(restaurantId, substitutionId);
}

export async function expireIngredientSubstitution(
  restaurantId: string,
  substitutionId: string
): Promise<IngredientSubstitution> {
  return repository.expireIngredientSubstitution(restaurantId, substitutionId);
}

export function substitutionEligibleInventoryItems(
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
    .sort((left, right) => left.item_name.localeCompare(right.item_name) || left.id.localeCompare(right.id));
}

export {
  convertSourceQuantityToSubstitute,
  isActiveVerifiedSubstitution,
  listActiveVerifiedSubstitutesForItem,
  normalizeIngredientSubstitution,
  presentIngredientSubstitutionRatio
};

function statusSortRank(status: IngredientSubstitution["verificationStatus"]): number {
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
