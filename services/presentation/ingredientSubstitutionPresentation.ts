import type { IngredientSubstitutionListItem } from "../domain/ingredientSubstitutions";
import {
  isActiveVerifiedSubstitution,
  presentIngredientSubstitutionRatio
} from "../domain/ingredientSubstitutions";

export interface InventoryVerifiedSubstituteRow {
  id: string;
  substituteItemName: string;
  ratioLabel: string;
  substituteInventoryItemId: string;
}

/**
 * Read-only rows for inventory detail. Only active verified source→substitute
 * ratios are included; drafts, rejected, expired, and inactive windows are omitted.
 */
export function presentInventoryVerifiedSubstituteRows(
  substitutions: readonly IngredientSubstitutionListItem[],
  sourceInventoryItemId: string,
  at: string | Date = new Date()
): InventoryVerifiedSubstituteRow[] {
  const sourceId = sourceInventoryItemId.trim();
  if (!sourceId) return [];

  return substitutions
    .filter(
      (entry) =>
        entry.sourceInventoryItemId === sourceId && isActiveVerifiedSubstitution(entry, at)
    )
    .map((entry) => ({
      id: entry.id,
      substituteItemName: entry.substituteItemName.trim() || entry.substituteInventoryItemId,
      ratioLabel: presentIngredientSubstitutionRatio(entry),
      substituteInventoryItemId: entry.substituteInventoryItemId
    }))
    .sort(
      (left, right) =>
        left.substituteItemName.localeCompare(right.substituteItemName) ||
        left.id.localeCompare(right.id)
    );
}
