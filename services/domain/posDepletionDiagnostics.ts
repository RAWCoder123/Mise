import type { InventoryItem, MenuItemIngredient, PosSale } from "../../types/mise";
import { inventoryUnitsAreCompatible } from "./inventoryUnits";
import {
  resolveVerifiedProviderMenuItemId,
  saleMatchesRecipe,
  saleRequiresVerifiedProviderIdentity,
  type VerifiedProviderSaleMapping
} from "./providerSaleIdentity";

export const POS_DEPLETION_SKIP_REASONS = [
  "unverified_provider_mapping",
  "unmapped_recipe",
  "incompatible_recipe_units",
  "missing_inventory_item"
] as const;

export type PosDepletionSkipReason = (typeof POS_DEPLETION_SKIP_REASONS)[number];

export interface PosDepletionSkipSample {
  itemName: string;
  quantitySold: number;
  reason: PosDepletionSkipReason;
  sourceRecordId: string | null;
}

export interface PosDepletionDiagnostics {
  restaurantId: string;
  operatingDate: string;
  todaySaleCount: number;
  depletingSaleCount: number;
  skippedSaleCount: number;
  partialAttentionSaleCount: number;
  countsByReason: Record<PosDepletionSkipReason, number>;
  samples: PosDepletionSkipSample[];
  uniqueUnmappedItemNames: string[];
  uniqueIncompatibleItemNames: string[];
  uniqueUnverifiedItemNames: string[];
}

const MAX_SAMPLES = 12;
const MAX_UNIQUE_NAMES = 24;

export function emptyPosDepletionReasonCounts(): Record<PosDepletionSkipReason, number> {
  return {
    unverified_provider_mapping: 0,
    unmapped_recipe: 0,
    incompatible_recipe_units: 0,
    missing_inventory_item: 0
  };
}

export function buildPosDepletionDiagnostics(input: {
  restaurantId: string;
  operatingDate: string;
  sales: readonly PosSale[];
  mappings: readonly MenuItemIngredient[];
  inventoryItems: readonly InventoryItem[];
  providerMappings?: readonly VerifiedProviderSaleMapping[];
}): PosDepletionDiagnostics {
  const restaurantId = requireRestaurantId(input.restaurantId);
  const operatingDate = requireOperatingDate(input.operatingDate);
  const providerMappings = input.providerMappings ?? [];
  const inventoryById = new Map(
    input.inventoryItems
      .filter((item) => item.restaurant_id === restaurantId)
      .map((item) => [item.id, item] as const)
  );
  const restaurantMappings = input.mappings.filter((mapping) => mapping.restaurant_id === restaurantId);
  const todaySales = input.sales.filter(
    (sale) =>
      sale.restaurant_id === restaurantId &&
      sale.sale_date === operatingDate &&
      Number.isFinite(sale.quantity_sold) &&
      sale.quantity_sold > 0
  );

  const countsByReason = emptyPosDepletionReasonCounts();
  const samples: PosDepletionSkipSample[] = [];
  const unmappedNames = new Set<string>();
  const incompatibleNames = new Set<string>();
  const unverifiedNames = new Set<string>();
  let depletingSaleCount = 0;
  let skippedSaleCount = 0;
  let partialAttentionSaleCount = 0;

  for (const sale of todaySales) {
    const classification = classifySaleDepletion({
      sale,
      mappings: restaurantMappings,
      inventoryById,
      providerMappings
    });

    if (classification.kind === "depleting") {
      depletingSaleCount += 1;
      continue;
    }

    if (classification.kind === "partial") {
      depletingSaleCount += 1;
      partialAttentionSaleCount += 1;
      incompatibleNames.add(boundedItemName(sale.item_name));
      continue;
    }

    skippedSaleCount += 1;
    countsByReason[classification.reason] += 1;
    if (classification.reason === "unmapped_recipe") {
      unmappedNames.add(boundedItemName(sale.item_name));
    } else if (classification.reason === "unverified_provider_mapping") {
      unverifiedNames.add(boundedItemName(sale.item_name));
    } else if (
      classification.reason === "incompatible_recipe_units" ||
      classification.reason === "missing_inventory_item"
    ) {
      incompatibleNames.add(boundedItemName(sale.item_name));
    }

    if (samples.length < MAX_SAMPLES) {
      samples.push({
        itemName: boundedItemName(sale.item_name),
        quantitySold: roundQuantity(sale.quantity_sold),
        reason: classification.reason,
        sourceRecordId: sale.source_record_id ?? null
      });
    }
  }

  return {
    restaurantId,
    operatingDate,
    todaySaleCount: todaySales.length,
    depletingSaleCount,
    skippedSaleCount,
    partialAttentionSaleCount,
    countsByReason,
    samples,
    uniqueUnmappedItemNames: sortUniqueNames(unmappedNames),
    uniqueIncompatibleItemNames: sortUniqueNames(incompatibleNames),
    uniqueUnverifiedItemNames: sortUniqueNames(unverifiedNames)
  };
}

export function assertPosDepletionDiagnosticsTenantScoped(
  diagnostics: PosDepletionDiagnostics,
  restaurantId: string
) {
  const expected = requireRestaurantId(restaurantId);
  if (diagnostics.restaurantId !== expected) {
    throw new Error("POS depletion diagnostics crossed restaurant scope.");
  }
}

function classifySaleDepletion(input: {
  sale: PosSale;
  mappings: readonly MenuItemIngredient[];
  inventoryById: ReadonlyMap<string, InventoryItem>;
  providerMappings: readonly VerifiedProviderSaleMapping[];
}):
  | { kind: "depleting" }
  | { kind: "partial" }
  | { kind: "skipped"; reason: PosDepletionSkipReason } {
  const { sale, mappings, inventoryById, providerMappings } = input;

  if (saleRequiresVerifiedProviderIdentity(sale)) {
    const menuItemId = resolveVerifiedProviderMenuItemId(sale, providerMappings);
    if (!menuItemId) {
      return { kind: "skipped", reason: "unverified_provider_mapping" };
    }
  }

  const matched = mappings.filter((mapping) => saleMatchesRecipe(sale, mapping, providerMappings));
  if (matched.length === 0) {
    return { kind: "skipped", reason: "unmapped_recipe" };
  }

  let compatibleCount = 0;
  let incompatibleCount = 0;
  let missingCount = 0;

  for (const mapping of matched) {
    const inventoryItem = inventoryById.get(mapping.inventory_item_id);
    if (!inventoryItem) {
      missingCount += 1;
      continue;
    }
    if (!inventoryUnitsAreCompatible(inventoryItem.unit, mapping.unit)) {
      incompatibleCount += 1;
      continue;
    }
    compatibleCount += 1;
  }

  if (compatibleCount > 0 && (incompatibleCount > 0 || missingCount > 0)) {
    return { kind: "partial" };
  }
  if (compatibleCount > 0) {
    return { kind: "depleting" };
  }
  if (missingCount > 0 && incompatibleCount === 0) {
    return { kind: "skipped", reason: "missing_inventory_item" };
  }
  return { kind: "skipped", reason: "incompatible_recipe_units" };
}

function requireRestaurantId(value: string) {
  const restaurantId = value.trim();
  if (!restaurantId) throw new Error("POS depletion diagnostics restaurant id is required.");
  return restaurantId;
}

function requireOperatingDate(value: string) {
  const operatingDate = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operatingDate)) {
    throw new Error("POS depletion diagnostics operating date is invalid.");
  }
  return operatingDate;
}

function boundedItemName(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Menu item";
  return trimmed.slice(0, 80);
}

function roundQuantity(value: number) {
  return Math.round(value * 1000) / 1000;
}

function sortUniqueNames(names: ReadonlySet<string>) {
  return [...names].sort((a, b) => a.localeCompare(b)).slice(0, MAX_UNIQUE_NAMES);
}
