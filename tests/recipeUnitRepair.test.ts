import assert from "node:assert/strict";
import test from "node:test";

import { setMiseRepositoryForTesting } from "../services/application/repository";
import { updateRecipeBaselineIngredient } from "../services/application/inventory";
import { inventoryUnitsAreCompatible } from "../services/domain/inventoryUnits";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { PlanningData, MiseRepository } from "../services/repositories/repositoryContracts";
import type {
  Insight,
  InventoryItem,
  MenuItemIngredient,
  PurchaseRecommendation,
  Restaurant
} from "../types/mise";

const restaurantId = "restaurant-recipe-unit-repair";
const supplierId = "33333333-3333-4333-8333-333333333333";
const operatingDate = "2026-08-31";

const inventoryItem: InventoryItem = {
  id: "inventory-chicken",
  restaurant_id: restaurantId,
  item_name: "Chicken breast",
  category: "Proteins",
  unit: "lbs",
  current_quantity: 20,
  par_level: 40,
  reorder_threshold: 12,
  estimated_unit_cost: 4.5,
  supplier_id: supplierId,
  supplier_name: "Farm Co.",
  last_updated: "2026-08-31T10:00:00.000Z"
};

const incompatibleMapping: MenuItemIngredient = {
  id: "mapping-chicken-bowl",
  restaurant_id: restaurantId,
  menu_item_id: "menu-chicken-bowl",
  menu_item_name: "Chicken Bowl",
  inventory_item_id: inventoryItem.id,
  quantity_used_per_sale: 0.5,
  unit: "kg"
};

const planningData: PlanningData = {
  inventoryItems: [inventoryItem],
  sales: [],
  menuItemIngredients: [incompatibleMapping],
  providerMappings: [],
  operatingDate,
  timeZone: "America/Los_Angeles"
};

function makeRepository(overrides?: {
  planning?: PlanningData;
}): MiseRepository & { lastSavedUnit: string | null } {
  const restaurant: Restaurant = {
    id: restaurantId,
    name: "Unit Repair Kitchen",
    address: null,
    cuisine_type: "Fast casual",
    timezone: "America/Los_Angeles",
    currency: "USD",
    service_style: "fast_casual",
    operational_profile: {
      serviceStyle: "fast_casual",
      orderCadence: [],
      prepWindows: [],
      primarySuppliers: [],
      inventoryReviewDays: [],
      notes: null
    },
    brand_color: "#ffffff",
    accent_color: "#111111",
    logo_url: null,
    created_at: "2026-08-01T00:00:00.000Z"
  };

  let lastSavedUnit: string | null = null;
  const activePlanning = overrides?.planning ?? planningData;

  const result: Partial<MiseRepository> & { lastSavedUnit: string | null } = {
    get lastSavedUnit() {
      return lastSavedUnit;
    },
    async fetchPlanningData() {
      return activePlanning;
    },
    async fetchRecommendationHistory() {
      return [];
    },
    async listInventoryEvents() {
      return [] as InventoryEvent[];
    },
    async saveRecipeMappingAndSignals(input) {
      lastSavedUnit = input.unit;
      const existing =
        activePlanning.menuItemIngredients.find((entry) => entry.id === input.mappingId) ??
        incompatibleMapping;
      return {
        ...existing,
        quantity_used_per_sale: input.quantityUsedPerSale,
        unit: input.unit
      };
    },
    async fetchRestaurantData() {
      return {
        restaurant,
        sales: [...activePlanning.sales],
        inventoryItems: [...activePlanning.inventoryItems],
        purchaseRecommendations: [] as PurchaseRecommendation[],
        insights: [] as Insight[],
        menuItemIngredients: [...activePlanning.menuItemIngredients],
        providerMappings: [...activePlanning.providerMappings]
      };
    }
  };

  return result as MiseRepository & { lastSavedUnit: string | null };
}

test("updateRecipeBaselineIngredient aligns recipe unit to current inventory unit", async () => {
  assert.equal(inventoryUnitsAreCompatible(inventoryItem.unit, incompatibleMapping.unit), false);

  const repository = makeRepository();
  const restore = setMiseRepositoryForTesting(repository);

  try {
    const saved = await updateRecipeBaselineIngredient(
      restaurantId,
      incompatibleMapping.id,
      incompatibleMapping.quantity_used_per_sale
    );

    assert.equal(saved.unit, "lbs");
    assert.equal(inventoryUnitsAreCompatible(inventoryItem.unit, saved.unit), true);
    assert.equal(saved.quantity_used_per_sale, 0.5);
    assert.equal(repository.lastSavedUnit, "lbs");
  } finally {
    restore();
  }
});

test("updateRecipeBaselineIngredient rejects missing inventory for a recipe mapping", async () => {
  const orphanMapping: MenuItemIngredient = {
    ...incompatibleMapping,
    id: "mapping-orphan",
    inventory_item_id: "missing-inventory"
  };
  const repository = makeRepository({
    planning: {
      ...planningData,
      menuItemIngredients: [orphanMapping]
    }
  });
  const restore = setMiseRepositoryForTesting(repository);

  try {
    await assert.rejects(
      () => updateRecipeBaselineIngredient(restaurantId, orphanMapping.id, 0.5),
      /Inventory item not found/
    );
  } finally {
    restore();
  }
});
