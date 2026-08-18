import assert from "node:assert/strict";
import test from "node:test";

import { setMiseRepositoryForTesting } from "../services/application/repository";
import { fetchInventoryOutlookItems, fetchRecipeBaselineSummary } from "../services/application/inventory";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { VerifiedProviderSaleMapping } from "../services/domain/providerSaleIdentity";
import type { PlanningData, MiseRepository } from "../services/repositories/repositoryContracts";
import type { InventoryItem, MenuItemIngredient, PosSale, PurchaseRecommendation, Insight, Restaurant } from "../types/mise";

const restaurantId = "restaurant-app-provider-mappings";
const operatingDate = "2026-08-18";
const inventoryItem: InventoryItem = {
  id: "inventory-burger-buns",
  restaurant_id: restaurantId,
  item_name: "Burger Buns",
  category: "Bakery",
  unit: "each",
  current_quantity: 20,
  par_level: 40,
  reorder_threshold: 12,
  estimated_unit_cost: 0.5,
  supplier_name: "Bakery Co.",
  last_updated: "2026-08-18T10:00:00.000Z"
};
const recipe: MenuItemIngredient = {
  id: "recipe-burger-buns",
  restaurant_id: restaurantId,
  menu_item_id: "menu-burger",
  menu_item_name: "Burger",
  inventory_item_id: inventoryItem.id,
  quantity_used_per_sale: 1,
  unit: "each"
};
const verifiedProviderMappings: VerifiedProviderSaleMapping[] = [{
  restaurantId,
  sourcePos: "square",
  providerLocationId: "loc-a",
  externalCatalogItemId: "ITEM-A",
  externalVariationId: "VAR-A",
  menuItemId: "menu-burger"
}];
const verifiedSale: PosSale = {
  id: "sale-1",
  restaurant_id: restaurantId,
  source_record_id: "square-order-line-1",
  provider_catalog_item_id: "ITEM-A",
  provider_variation_id: "VAR-A",
  provider_location_id: "loc-a",
  sale_date: operatingDate,
  item_name: "Renamed Burger",
  category: "Square",
  quantity_sold: 2,
  gross_sales: 20,
  net_sales: 20,
  source_pos: "Square",
  created_at: "2026-08-18T12:00:00.000Z"
};
const planningData: PlanningData = {
  inventoryItems: [inventoryItem],
  sales: [verifiedSale],
  menuItemIngredients: [recipe],
  providerMappings: verifiedProviderMappings,
  operatingDate,
  timeZone: "America/Los_Angeles"
};

function makeRepository(providerMappings: readonly VerifiedProviderSaleMapping[]): MiseRepository {
  const restaurant: Restaurant = {
    id: restaurantId,
    name: "Provider Kitchen",
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
    created_at: "2026-08-18T00:00:00.000Z"
  };
  const result: Partial<MiseRepository> = {
    async fetchPlanningData() {
      return { ...planningData, providerMappings: [...providerMappings] };
    },
    async fetchRestaurantData() {
      return {
        restaurant,
        sales: [...planningData.sales],
        inventoryItems: [...planningData.inventoryItems],
        purchaseRecommendations: [] as PurchaseRecommendation[],
        insights: [] as Insight[],
        menuItemIngredients: [...planningData.menuItemIngredients],
        providerMappings: [...providerMappings]
      };
    },
    async listInventoryEvents() {
      return [] as InventoryEvent[];
    }
  };
  return result as MiseRepository;
}

function outlookDepletion(providerMappings: readonly VerifiedProviderSaleMapping[]) {
  const restore = setMiseRepositoryForTesting(makeRepository(providerMappings));
  return fetchInventoryOutlookItems(restaurantId)
    .then((outlooks) => outlooks.find((outlook) => outlook.item.id === inventoryItem.id)?.prediction.todayDepletion ?? 0)
    .finally(restore);
}

function recipeCoverage(providerMappings: readonly VerifiedProviderSaleMapping[]) {
  const restore = setMiseRepositoryForTesting(makeRepository(providerMappings));
  return fetchRecipeBaselineSummary(restaurantId)
    .then((summary) => summary.coveragePercent)
    .finally(restore);
}

test("application planning consumes verified provider mappings from repository data", async () => {
  assert.equal(await outlookDepletion(verifiedProviderMappings), 2);
  assert.equal(await recipeCoverage(verifiedProviderMappings), 100);
  assert.equal(await outlookDepletion([]), 0);
  assert.equal(await recipeCoverage([]), 0);
});
