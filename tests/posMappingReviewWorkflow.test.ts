import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fetchInventoryOutlookItems } from "../services/application/inventory";
import { setMiseRepositoryForTesting } from "../services/application/repository";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { VerifiedProviderSaleMapping } from "../services/domain/providerSaleIdentity";
import type {
  MiseRepository,
  PlanningData,
  PosMappingReviewQueue,
  PosMappingReviewResult
} from "../services/repositories/repositoryContracts";
import type { InventoryItem, MenuItemIngredient, PosSale } from "../types/mise";

const restaurantId = "restaurant-pos-review";
const mappingId = "mapping-pos-review";
const suggestedMenuItemId = "menu-suggested";
const operatorMenuItemId = "menu-operator";
const inventoryItem: InventoryItem = {
  id: "inventory-buns",
  restaurant_id: restaurantId,
  item_name: "Burger Buns",
  category: "Bakery",
  unit: "each",
  current_quantity: 20,
  par_level: 30,
  reorder_threshold: 10,
  estimated_unit_cost: 0.5,
  supplier_name: "Bakery",
  last_updated: "2026-08-20T10:00:00.000Z"
};
const recipe: MenuItemIngredient = {
  id: "recipe-operator-burger",
  restaurant_id: restaurantId,
  menu_item_id: operatorMenuItemId,
  menu_item_name: "Operator Burger",
  inventory_item_id: inventoryItem.id,
  quantity_used_per_sale: 1,
  unit: "each"
};
const sale: PosSale = {
  id: "sale-square-burger",
  restaurant_id: restaurantId,
  source_record_id: "square-line-1",
  provider_location_id: "square-loc-a",
  provider_catalog_item_id: "ITEM-A",
  provider_variation_id: "VAR-A",
  sale_date: "2026-08-20",
  item_name: "Provider Renamed Burger",
  category: "Square",
  quantity_sold: 2,
  gross_sales: 24,
  net_sales: 24,
  source_pos: "Square",
  created_at: "2026-08-20T12:00:00.000Z"
};

function createReviewRepository(): MiseRepository {
  let status: "draft" | "verified" | "rejected" = "draft";
  let selectedMenuItemId = suggestedMenuItemId;
  const queue: PosMappingReviewQueue = {
    restaurantId,
    mappings: [{
      id: mappingId,
      restaurantId,
      provider: "square",
      locationId: "location-a",
      providerLocationId: "square-loc-a",
      locationName: "Downtown",
      externalCatalogItemId: "ITEM-A",
      externalVariationId: "VAR-A",
      externalName: "Square Burger",
      suggestedMenuItemId,
      suggestedMenuItemName: "Suggested Burger",
      suggestedMenuItemCategory: "Entree",
      verificationStatus: "draft",
      updatedAt: "2026-08-20T12:00:00.000Z"
    }],
    menuItems: [
      { id: suggestedMenuItemId, restaurantId, name: "Suggested Burger", category: "Entree" },
      { id: operatorMenuItemId, restaurantId, name: "Operator Burger", category: "Entree" }
    ]
  };
  const providerMapping = (): VerifiedProviderSaleMapping[] => status === "verified" ? [{
    restaurantId,
    sourcePos: "square",
    providerLocationId: "square-loc-a",
    externalCatalogItemId: "ITEM-A",
    externalVariationId: "VAR-A",
    menuItemId: selectedMenuItemId
  }] : [];
  const planning = (): PlanningData => ({
    inventoryItems: [inventoryItem],
    sales: [sale],
    menuItemIngredients: [recipe],
    providerMappings: providerMapping(),
    operatingDate: "2026-08-20",
    timeZone: "America/New_York"
  });

  const repository: Partial<MiseRepository> = {
    async fetchPosMappingReviewQueue(requestedRestaurantId) {
      assert.equal(requestedRestaurantId, restaurantId);
      return {
        ...queue,
        mappings: status === "draft" ? [...queue.mappings] : []
      };
    },
    async reviewPosCatalogMapping(requestedRestaurantId, requestedMappingId, menuItemId, decision) {
      assert.equal(requestedRestaurantId, restaurantId);
      assert.equal(requestedMappingId, mappingId);
      if (status === "verified" && decision === "verify" && menuItemId === selectedMenuItemId) {
        return result("already_verified", "verified", selectedMenuItemId);
      }
      if (status === "rejected" && decision === "reject") {
        return result("already_rejected", "rejected", selectedMenuItemId);
      }
      assert.equal(status, "draft");
      if (decision === "verify") {
        assert.ok(menuItemId);
        selectedMenuItemId = menuItemId;
        status = "verified";
        return result("verified", "verified", selectedMenuItemId);
      }
      assert.equal(menuItemId, null);
      status = "rejected";
      return result("rejected", "rejected", selectedMenuItemId);
    },
    async fetchPlanningData() {
      return planning();
    },
    async listInventoryEvents() {
      return [] as InventoryEvent[];
    }
  };
  return repository as MiseRepository;
}

function result(
  outcome: PosMappingReviewResult["outcome"],
  verificationStatus: PosMappingReviewResult["verificationStatus"],
  menuItemId: string
): PosMappingReviewResult {
  return {
    outcome,
    mappingId,
    restaurantId,
    menuItemId,
    verificationStatus,
    verifiedAt: verificationStatus === "verified" ? "2026-08-20T12:30:00.000Z" : null,
    verifiedBy: verificationStatus === "verified" ? "manager-a" : null
  };
}

async function todayDepletion() {
  const outlooks = await fetchInventoryOutlookItems(restaurantId);
  return outlooks.find((outlook) => outlook.item.id === inventoryItem.id)?.prediction.todayDepletion ?? 0;
}

test("application planning stays closed before review and uses only the explicit operator verification", async () => {
  const repository = createReviewRepository();
  const restore = setMiseRepositoryForTesting(repository);
  try {
    assert.equal(await todayDepletion(), 0);
    const queue = await repository.fetchPosMappingReviewQueue(restaurantId);
    assert.equal(queue.mappings[0]?.suggestedMenuItemId, suggestedMenuItemId);

    const applied = await repository.reviewPosCatalogMapping(
      restaurantId,
      mappingId,
      operatorMenuItemId,
      "verify"
    );
    assert.equal(applied.outcome, "verified");
    assert.equal(applied.menuItemId, operatorMenuItemId);
    assert.equal((await repository.fetchPosMappingReviewQueue(restaurantId)).mappings.length, 0);
    assert.equal(await todayDepletion(), 2);

    const replay = await repository.reviewPosCatalogMapping(
      restaurantId,
      mappingId,
      operatorMenuItemId,
      "verify"
    );
    assert.equal(replay.outcome, "already_verified");
    assert.equal(await todayDepletion(), 2);
  } finally {
    restore();
  }
});

test("application rejection removes the draft from review without authorizing planning", async () => {
  const repository = createReviewRepository();
  const restore = setMiseRepositoryForTesting(repository);
  try {
    assert.equal(await todayDepletion(), 0);
    const rejected = await repository.reviewPosCatalogMapping(restaurantId, mappingId, null, "reject");
    assert.equal(rejected.outcome, "rejected");
    assert.equal((await repository.fetchPosMappingReviewQueue(restaurantId)).mappings.length, 0);
    assert.equal(await todayDepletion(), 0);
  } finally {
    restore();
  }
});

test("hosted mapping review stays behind guarded RPCs with no direct authenticated update", () => {
  const application = readFileSync("services/application/pos.ts", "utf8");
  const repository = readFileSync("services/repositories/supabaseRepository.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260820140958_pos_mapping_review_workflow.sql",
    "utf8"
  );
  const reviewMethod = repository.slice(
    repository.indexOf("async reviewPosCatalogMapping"),
    repository.indexOf("async sendSupplierOrderEmail")
  );

  assert.match(repository, /client\.rpc\("list_pos_catalog_mapping_reviews"/);
  assert.match(application, /export async function fetchPosMappingReviewQueue/);
  assert.match(application, /export async function reviewPosCatalogMapping/);
  assert.match(application, /requireWorkflowId\(mappingId, "mapping"\)/);
  assert.match(reviewMethod, /client\.rpc\("review_pos_catalog_mapping"/);
  assert.doesNotMatch(reviewMethod, /\.from\("pos_catalog_item_mappings"\)/);
  assert.doesNotMatch(reviewMethod, /\.(?:update|upsert|insert|delete)\(/);
  assert.match(migration, /private\.has_restaurant_role\([\s\S]*array\['owner', 'admin', 'manager'\]/);
  assert.match(migration, /from public\.pos_catalog_item_mappings mapping[\s\S]*for update;/);
  assert.match(migration, /verification_status = 'verified'/);
  assert.match(migration, /verification_status = 'rejected'/);
  assert.match(migration, /revoke insert, update, delete on table public\.pos_catalog_item_mappings from authenticated/);
  assert.match(migration, /revoke all on function public\.review_pos_catalog_mapping[\s\S]*service_role/);
  assert.match(migration, /insert into public\.audit_logs/);
  assert.match(migration, /limit 100/);
  assert.match(migration, /limit 200/);
});

test("mapping review UI presents suggestions as provisional and updates the queue after decisions", () => {
  const screen = readFileSync("app/settings/pos-mappings.tsx", "utf8");
  const posSettings = readFileSync("app/settings/pos.tsx", "utf8");
  const layout = readFileSync("app/_layout.tsx", "utf8");
  const routeSmoke = readFileSync("scripts/mobile-route-smoke.mjs", "utf8");
  const layoutSmoke = readFileSync("scripts/mobile-layout-smoke.mjs", "utf8");

  assert.match(screen, /mapping\.locationName/);
  assert.match(screen, /mapping\.externalName/);
  assert.match(screen, /mapping\.suggestedMenuItemName/);
  assert.match(screen, /pos\.mappings\.suggestionBody/);
  assert.match(screen, /queue\.menuItems\.map/);
  assert.match(screen, /accessibilityRole="radio"/);
  assert.match(screen, /reviewPosCatalogMapping/);
  assert.match(screen, /mappings: current\.mappings\.filter\(\(mapping\) => mapping\.id !== mappingId\)/);
  assert.match(screen, /canManageRestaurantData\(memberships, restaurant\?\.id\)/);
  assert.match(screen, /activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(posSettings, /mappingReviewCount/);
  assert.match(posSettings, /router\.push\("\/settings\/pos-mappings"/);
  assert.match(layout, /<Stack\.Screen name="settings\/pos-mappings" \/>/);
  assert.match(routeSmoke, /"\/settings\/pos-mappings"/);
  assert.match(layoutSmoke, /"\/settings\/pos-mappings"/);
  assert.doesNotMatch(screen, /access[_ ]?token|refresh[_ ]?token|client[_ ]?secret|raw[_ ]?payload/i);
});
