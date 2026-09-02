/**
 * Fail-closed POS sale depletion with verified modifier_recipe_adjustments.
 * Sales without selected modifiers keep the existing inventory-unit recipe path.
 * Sales with modifiers require a recipe version, verified canonical conversions,
 * and a verified adjustment for every selected external modifier id.
 */

import { inventoryUnitsAreCompatible } from "./inventoryUnits.ts";
import {
  applyVerifiedModifierDeltas,
  type ModifierRecipeAdjustment,
  type ModifierRecipeAdjustmentCanonicalUnit
} from "./modifierRecipeAdjustments.ts";

const MAX_SELECTED_MODIFIERS = 32;

export type ModifierDepletionSale = {
  restaurant_id: string;
  quantity_sold: number;
  selected_modifier_ids?: readonly string[] | null;
};

export type ModifierDepletionMapping = {
  restaurant_id: string;
  inventory_item_id: string;
  quantity_used_per_sale: number;
  unit: string;
  menu_item_id?: string | null;
};

export type ModifierDepletionInventoryItem = {
  id: string;
  restaurant_id: string;
  item_name: string;
  unit: string;
  canonical_unit?: ModifierRecipeAdjustmentCanonicalUnit | string | null;
  canonical_quantity_per_unit?: number | null;
  canonical_unit_verification_status?: string | null;
};

export type ModifierDepletionContext = {
  adjustments: readonly ModifierRecipeAdjustment[];
  /** Active restaurant-wide recipe_versions.id keyed by menu_items.id */
  recipeVersionIdByMenuItemId: ReadonlyMap<string, string>;
};

export type SaleIngredientUsageResult =
  | { status: "base" | "modified"; usageByItemId: Map<string, number> }
  | { status: "skipped_unverified_modifiers"; usageByItemId: Map<string, number> };

export function normalizeSelectedModifierIds(
  value: unknown
): string[] {
  if (value == null) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || id.length > 128 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_SELECTED_MODIFIERS) break;
  }
  return out;
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function hasVerifiedCanonicalConversion(
  item: ModifierDepletionInventoryItem,
  expectedUnit?: ModifierRecipeAdjustmentCanonicalUnit | null
): item is ModifierDepletionInventoryItem & {
  canonical_unit: ModifierRecipeAdjustmentCanonicalUnit;
  canonical_quantity_per_unit: number;
} {
  if (item.canonical_unit_verification_status !== "verified") return false;
  if (
    item.canonical_unit !== "g" &&
    item.canonical_unit !== "ml" &&
    item.canonical_unit !== "each"
  ) {
    return false;
  }
  if (
    expectedUnit != null &&
    item.canonical_unit !== expectedUnit
  ) {
    return false;
  }
  const factor = Number(item.canonical_quantity_per_unit);
  return Number.isFinite(factor) && factor > 0;
}

function resolveRecipeVersionId(
  mappings: readonly ModifierDepletionMapping[],
  context: ModifierDepletionContext
): string | null {
  for (const mapping of mappings) {
    const menuItemId = mapping.menu_item_id?.trim() ?? "";
    if (!menuItemId) continue;
    const versionId = context.recipeVersionIdByMenuItemId.get(menuItemId)?.trim() ?? "";
    if (versionId) return versionId;
  }
  return null;
}

/**
 * Inventory-unit ingredient usage for one sale line.
 * Returns skipped_unverified_modifiers (empty usage) when modifiers are present
 * but cannot be applied without inventing deltas or conversions.
 */
export function accumulateSaleIngredientUsage(input: {
  sale: ModifierDepletionSale;
  matchingMappings: readonly ModifierDepletionMapping[];
  itemsById: ReadonlyMap<string, ModifierDepletionInventoryItem>;
  modifierContext?: ModifierDepletionContext | null;
}): SaleIngredientUsageResult {
  const empty = new Map<string, number>();
  const sold = finiteNonNegative(input.sale.quantity_sold);
  if (sold <= 0 || input.matchingMappings.length === 0) {
    return { status: "base", usageByItemId: empty };
  }

  const selected = normalizeSelectedModifierIds(input.sale.selected_modifier_ids);
  if (selected.length === 0) {
    const usageByItemId = new Map<string, number>();
    for (const mapping of input.matchingMappings) {
      const item = input.itemsById.get(mapping.inventory_item_id);
      if (!item || item.restaurant_id !== input.sale.restaurant_id) continue;
      if (!inventoryUnitsAreCompatible(item.unit, mapping.unit)) continue;
      const quantity = sold * finiteNonNegative(mapping.quantity_used_per_sale);
      if (quantity <= 0) continue;
      usageByItemId.set(
        mapping.inventory_item_id,
        (usageByItemId.get(mapping.inventory_item_id) ?? 0) + quantity
      );
    }
    return { status: "base", usageByItemId };
  }

  const context = input.modifierContext;
  if (!context) {
    return { status: "skipped_unverified_modifiers", usageByItemId: empty };
  }

  const recipeVersionId = resolveRecipeVersionId(input.matchingMappings, context);
  if (!recipeVersionId) {
    return { status: "skipped_unverified_modifiers", usageByItemId: empty };
  }

  const baseCanonicalByItemId = new Map<string, number>();
  for (const mapping of input.matchingMappings) {
    const item = input.itemsById.get(mapping.inventory_item_id);
    if (!item || item.restaurant_id !== input.sale.restaurant_id) continue;
    if (!inventoryUnitsAreCompatible(item.unit, mapping.unit)) continue;
    if (!hasVerifiedCanonicalConversion(item)) {
      return { status: "skipped_unverified_modifiers", usageByItemId: empty };
    }
    const perSale = finiteNonNegative(mapping.quantity_used_per_sale);
    baseCanonicalByItemId.set(
      mapping.inventory_item_id,
      (baseCanonicalByItemId.get(mapping.inventory_item_id) ?? 0) +
        perSale * item.canonical_quantity_per_unit
    );
  }

  const adjusted = applyVerifiedModifierDeltas({
    baseCanonicalByItemId,
    recipeVersionId,
    selectedExternalModifierIds: selected,
    adjustments: context.adjustments.filter(
      (entry) => entry.restaurantId === input.sale.restaurant_id
    )
  });
  if (!adjusted) {
    return { status: "skipped_unverified_modifiers", usageByItemId: empty };
  }

  const usageByItemId = new Map<string, number>();
  for (const [itemId, canonicalQuantity] of adjusted.entries()) {
    if (!Number.isFinite(canonicalQuantity)) {
      return { status: "skipped_unverified_modifiers", usageByItemId: empty };
    }
    const item = input.itemsById.get(itemId);
    if (!item || item.restaurant_id !== input.sale.restaurant_id) {
      return { status: "skipped_unverified_modifiers", usageByItemId: empty };
    }
    const matchedAdjustment = context.adjustments.find(
      (entry) =>
        entry.restaurantId === input.sale.restaurant_id &&
        entry.recipeVersionId === recipeVersionId &&
        entry.inventoryItemId === itemId &&
        entry.verificationStatus === "verified" &&
        selected.includes(entry.externalModifierId)
    );
    if (!hasVerifiedCanonicalConversion(item, matchedAdjustment?.canonicalUnit)) {
      return { status: "skipped_unverified_modifiers", usageByItemId: empty };
    }
    const inventoryQuantity = (canonicalQuantity / item.canonical_quantity_per_unit) * sold;
    if (!Number.isFinite(inventoryQuantity)) {
      return { status: "skipped_unverified_modifiers", usageByItemId: empty };
    }
    usageByItemId.set(itemId, (usageByItemId.get(itemId) ?? 0) + inventoryQuantity);
  }

  return { status: "modified", usageByItemId };
}

export function usageForInventoryItemFromSale(input: {
  sale: ModifierDepletionSale;
  inventoryItemId: string;
  matchingMappings: readonly ModifierDepletionMapping[];
  itemsById: ReadonlyMap<string, ModifierDepletionInventoryItem>;
  modifierContext?: ModifierDepletionContext | null;
}): number {
  const result = accumulateSaleIngredientUsage(input);
  if (result.status === "skipped_unverified_modifiers") return 0;
  return result.usageByItemId.get(input.inventoryItemId) ?? 0;
}
