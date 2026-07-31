import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("operational screens reject late requests and render only active-restaurant data", () => {
  const screens = {
    today: source("app/(tabs)/today.tsx"),
    inventory: source("app/(tabs)/inventory.tsx"),
    orders: source("app/(tabs)/orders.tsx"),
    insights: source("app/(tabs)/insights.tsx"),
    settings: source("app/(tabs)/settings.tsx"),
    recipes: source("app/settings/recipes.tsx"),
    inventoryDetail: source("app/inventory/[id].tsx"),
    inventoryCount: source("app/inventory/count.tsx"),
    orderDetail: source("app/orders/[id].tsx")
  };

  for (const [name, screen] of Object.entries(screens)) {
    assert.match(screen, /requestIdRef\s*=\s*useRef\(0\)/, `${name} needs request generations`);
    assert.match(screen, /activeRestaurantIdRef/, `${name} needs active-restaurant identity checks`);
    assert.match(
      screen,
      /requestId\s*!==\s*requestIdRef\.current\s*\|\|\s*activeRestaurantIdRef\.current\s*!==\s*restaurantId/,
      `${name} must reject late responses`
    );
  }

  assert.match(screens.today, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*summary\s*:\s*null/);
  assert.match(screens.inventory, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*outlooks\s*:\s*\[\]/);
  assert.match(screens.insights, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*insights\s*:\s*\[\]/);
  assert.match(screens.settings, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*suppliers\s*:\s*\[\]/);
  assert.match(screens.orders, /loadedRestaurantRef\.current\s*===\s*restaurant\?\.id/);
  assert.match(screens.recipes, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*summary\s*:\s*null/);
  assert.match(screens.inventoryDetail, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*outlook\s*:\s*null/);
  assert.match(screens.inventoryCount, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*detail\s*:\s*null/);
  assert.match(screens.orderDetail, /loadedRestaurantId\s*===\s*restaurant\?\.id\s*\?\s*order\s*:\s*null/);
});

test("workspace mutations stop stale continuations and session state is latest-wins", () => {
  const inventoryDetail = source("app/inventory/[id].tsx");
  const inventoryCount = source("app/inventory/count.tsx");
  const orderDetail = source("app/orders/[id].tsx");
  const recipes = source("app/settings/recipes.tsx");
  const session = source("contexts/MiseSessionContext.tsx");

  assert.match(inventoryDetail, /await updateInventoryItem[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryDetail, /await recordInventoryWaste[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryCount, /await beginInventoryCountSession[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryCount, /await saveInventoryCountLines[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryCount, /await submitInventoryCountSession[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryCount, /await approveInventoryCountSession[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(inventoryCount, /await cancelInventoryCountSession[\s\S]*activeRestaurantIdRef\.current !== restaurantId/);
  assert.match(orderDetail, /await persistNote\(\)[\s\S]*activeRestaurantIdRef\.current !== restaurantId[\s\S]*await sendSupplierOrderEmail/);
  assert.match(recipes, /selectedInventoryItem\.restaurant_id !== restaurantId/);

  assert.match(session, /posRequestIdRef/);
  assert.match(session, /activeRestaurantIdRef\.current !== expectedRestaurantId/);
  assert.match(session, /switchRequestIdRef/);
  assert.match(session, /sessionRequestIdRef/);
  assert.match(session, /sessionRequestId\s*!==\s*sessionRequestIdRef\.current/);
  assert.match(session, /storageQueueRef/);
  assert.match(session, /subscribeToTenantAuthorizationDenials/);
  assert.match(session, /revalidateLiveMemberships/);
  assert.match(session, /activeId\s*&&\s*!activeMembership/);
  assert.match(session, /sessionRequestIdRef\.current \+= 1/);
  assert.match(session, /setRestaurant\(null\)/);
  assert.match(session, /setMemberships\(\[\]\)/);
  assert.match(session, /AppState\.addEventListener\("change"/);
});

test("repository permission failures trigger live membership revalidation", () => {
  const repository = source("services/repositories/miseRepository.ts");
  const events = source("services/tenantAuthorizationEvents.ts");

  assert.match(repository, /throwRepositoryError\(error, restaurantId\)/);
  assert.match(repository, /throwRepositoryError\(error, typeof body\.restaurantId/);
  assert.match(events, /code === "42501"/);
  assert.match(events, /status === 401/);
  assert.match(events, /status === 403/);
  assert.match(events, /notifyTenantAuthorizationDenied/);
});

test("manual tab controls expose their selected state on web", () => {
  const segmentedControl = source("components/ui/SegmentedControl.tsx");
  assert.match(segmentedControl, /accessibilityRole="tab"/);
  assert.match(segmentedControl, /aria-selected=\{selected\}/);

  for (const path of [
    "app/(tabs)/inventory.tsx",
    "app/(tabs)/insights.tsx",
    "app/(tabs)/orders.tsx"
  ]) {
    const screen = source(path);
    assert.match(screen, /components\/ui\/SegmentedControl/);
    assert.match(screen, /<(?:FilterRow|SegmentedControl)/);
  }
});
