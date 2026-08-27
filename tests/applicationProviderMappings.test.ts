import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { setMiseRepositoryForTesting } from "../services/application/repository";
import { fetchInventoryOutlookItems, fetchRecipeBaselineSummary } from "../services/application/inventory";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { VerifiedProviderSaleMapping } from "../services/domain/providerSaleIdentity";
import type { PlanningData, MiseRepository } from "../services/repositories/repositoryContracts";
import type { InventoryItem, MenuItemIngredient, PosSale, PurchaseRecommendation, Insight, Restaurant } from "../types/mise";
import { toDateKeyInTimeZone } from "../utils/format";

const require = createRequire(import.meta.url);

const restaurantId = "restaurant-app-provider-mappings";
const bakerySupplierId = "33333333-3333-4333-8333-333333333333";
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
  supplier_id: bakerySupplierId,
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
  timeZone: "America/Los_Angeles",
  purchaseLoopCountHistory: []
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

test("hosted repository planning data preserves provider identity through the real application outlook path", async () => {
  const hostedOperatingDate = toDateKeyInTimeZone(new Date(), "America/Los_Angeles");
  const moduleLoader = require("node:module") as typeof import("node:module") & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleLoader._load;

  const fakeClient = {
    rpc(name: string) {
      if (name !== "fetch_planning_sales") {
        throw new Error(`Unexpected RPC: ${name}`);
      }
      return Promise.resolve({
        data: [{
          id: verifiedSale.id,
          restaurant_id: verifiedSale.restaurant_id,
          // The hosted repository derives its operating date at read time. Keep
          // this sale on that same restaurant-local date so the test proves
          // provider identity propagation rather than depending on the wall
          // clock still being 2026-08-18.
          sale_date: hostedOperatingDate,
          item_name: verifiedSale.item_name,
          category: verifiedSale.category,
          quantity_sold: verifiedSale.quantity_sold,
          gross_sales: verifiedSale.gross_sales,
          net_sales: verifiedSale.net_sales,
          source_pos: verifiedSale.source_pos,
          created_at: verifiedSale.created_at,
          source_record_id: verifiedSale.source_record_id,
          provider_catalog_item_id: verifiedSale.provider_catalog_item_id,
          provider_location_id: verifiedSale.provider_location_id,
          provider_variation_id: verifiedSale.provider_variation_id
        }],
        error: null
      });
    },
    from(table: string) {
      class Query {
        private wantSingle = false;
        private filters = new Map<string, unknown>();

        constructor(private readonly tableName: string) {}

        select() {
          return this;
        }

        eq(column: string, value: unknown) {
          this.filters.set(column, value);
          return this;
        }

        order() {
          return this;
        }

        in() {
          return this;
        }

        gte() {
          return this;
        }

        gt() {
          return this;
        }

        limit() {
          return this;
        }

        single() {
          this.wantSingle = true;
          return this;
        }

        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(this.execute()).then(resolve, reject);
        }

        private execute() {
          const restaurant = {
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
          } satisfies Restaurant;

          const providerRows = [{
            restaurant_id: restaurantId,
            external_catalog_item_id: "ITEM-A",
            external_variation_id: "VAR-A",
            menu_item_id: "menu-burger",
            verification_status: "verified",
            effective_from: "2026-08-10T00:00:00.000Z",
            effective_to: null,
            pos_locations: {
              external_location_id: "loc-a",
              status: "active",
              pos_integrations: { provider: "square", status: "connected" }
            },
            menu_items: { active: true }
          }];

          const tableData: Record<string, unknown> = {
            inventory_items: [{
              ...inventoryItem,
              supplier: {
                id: bakerySupplierId,
                restaurant_id: restaurantId,
                display_name: "Bakery Co."
              }
            }],
            menu_item_ingredients: [recipe],
            restaurants: this.filters.get("id") === restaurantId ? restaurant : { timezone: "America/Los_Angeles" },
            pos_catalog_item_mappings: providerRows,
            inventory_events: [],
            action_outcomes: []
          };

          const data = tableData[this.tableName];
          if (this.wantSingle) return { data, error: null };
          return { data: Array.isArray(data) ? data : [data], error: null };
        }
      }

      return new Query(table);
    }
  };

  moduleLoader._load = function patchedLoad(request, parent, isMain) {
    if (request === "../../lib/supabase") {
      return { supabase: fakeClient };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const modulePath = require.resolve("../services/repositories/supabaseRepository");
  delete require.cache[modulePath];

  try {
    const { createSupabaseRepository } = require("../services/repositories/supabaseRepository") as typeof import("../services/repositories/supabaseRepository");
    const repository = createSupabaseRepository();
    const planning = await repository.fetchPlanningData(restaurantId);

    assert.equal(planning.sales[0]?.provider_location_id, "loc-a");
    assert.equal(planning.sales[0]?.provider_catalog_item_id, "ITEM-A");
    assert.equal(planning.sales[0]?.provider_variation_id, "VAR-A");

    const restore = setMiseRepositoryForTesting(repository);
    const depletion = await fetchInventoryOutlookItems(restaurantId)
      .then((outlooks) => outlooks.find((outlook) => outlook.item.id === inventoryItem.id)?.prediction.todayDepletion ?? 0)
      .finally(restore);

    assert.equal(depletion, 2);
  } finally {
    delete require.cache[modulePath];
    moduleLoader._load = originalLoad;
  }
});
