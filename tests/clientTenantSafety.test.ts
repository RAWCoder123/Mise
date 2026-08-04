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
    pos: source("app/settings/pos.tsx"),
    team: source("app/settings/team.tsx"),
    gmail: source("app/settings/gmail.tsx"),
    suppliers: source("app/settings/suppliers.tsx"),
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

  assert.match(screens.today, /resolveTodayHubLoadState/);
  assert.match(screens.today, /hubReady\s*\?\s*summary\s*:\s*null/);
  assert.match(
    source("services/presentation/todayHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.inventory, /resolveInventoryHubLoadState/);
  assert.match(screens.inventory, /hubReady\s*\?\s*outlooks\s*:\s*\[\]/);
  assert.match(screens.insights, /resolveInsightsHubLoadState/);
  assert.match(screens.insights, /hubReady\s*\?\s*insights\s*:\s*\[\]/);
  assert.match(screens.settings, /resolveSettingsHubLoadState/);
  assert.match(screens.settings, /hubReady\s*\?\s*suppliers\s*:\s*\[\]/);
  assert.match(
    source("services/presentation/settingsHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(
    source("services/presentation/inventoryHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(
    source("services/presentation/insightsHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.orders, /resolveOrdersHubLoadState/);
  assert.match(screens.orders, /hubReady\s*\?\s*recommendations\s*:\s*\[\]/);
  assert.match(screens.orders, /hubReady\s*\?\s*orders\s*:\s*\[\]/);
  assert.match(
    source("services/presentation/ordersHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.recipes, /resolveRecipesHubLoadState/);
  assert.match(screens.recipes, /hubReady\s*\?\s*summary\s*:\s*null/);
  assert.match(
    source("services/presentation/recipesHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.pos, /resolvePosHubLoadState/);
  assert.match(screens.pos, /hubReady\s*\?\s*posProvider\s*:\s*null/);
  assert.match(
    source("services/presentation/posHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.team, /resolveTeamHubLoadState/);
  assert.match(screens.team, /hubReady\s*\?\s*members\s*:\s*\[\]/);
  assert.match(
    source("services/presentation/teamHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.gmail, /resolveGmailHubLoadState/);
  assert.match(screens.gmail, /hubReady\s*\?\s*connection\s*:\s*null/);
  assert.match(
    source("services/presentation/gmailHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.suppliers, /resolveSuppliersHubLoadState/);
  assert.match(screens.suppliers, /hubReady\s*\?\s*entries\s*:\s*\[\]/);
  assert.match(
    source("services/presentation/suppliersHubPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.settings, /presentSettingsHubPosCopy/);
  assert.match(source("contexts/MiseSessionContext.tsx"), /posStatusRestaurantId/);
  assert.match(screens.inventoryDetail, /resolveInventoryDetailLoadState/);
  assert.match(screens.inventoryDetail, /hubReady\s*\?\s*outlook\s*:\s*null/);
  assert.match(
    source("services/presentation/inventoryDetailPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.inventoryCount, /resolveInventoryCountLoadState/);
  assert.match(screens.inventoryCount, /hubReady\s*\?\s*detail\s*:\s*null/);
  assert.match(
    source("services/presentation/inventoryCountPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );
  assert.match(screens.orderDetail, /resolveOrderDetailLoadState/);
  assert.match(screens.orderDetail, /hubReady\s*\?\s*order\s*:\s*null/);
  assert.match(
    source("services/presentation/orderDetailPresentation.ts"),
    /loadedRestaurantId\s*===\s*input\.restaurantId/
  );

  const inventoryCreate = source("app/inventory/new.tsx");
  assert.match(inventoryCreate, /activeRestaurantIdRef/);
  assert.match(inventoryCreate, /resolveInventoryCreateAccessState/);
  assert.match(inventoryCreate, /activeRestaurantIdRef\.current\s*!==\s*restaurantId/);
  assert.doesNotMatch(
    inventoryCreate,
    /error\s+instanceof\s+Error\s*\?\s*error\.message/
  );
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
  assert.match(session, /failClosedOnError:\s*true/);
  assert.match(session, /clearUnverifiedWorkspaceAccess/);
  assert.match(session, /workspaceAccessUnverified/);
  assert.match(session, /clearWorkspaceAccessUnverified/);
  assert.match(session, /setWorkspaceAccessUnverified\(true\)/);
  assert.match(session, /pendingDenialRevalidation/);
  assert.match(session, /activeId\s*&&\s*!activeMembership/);
  assert.match(session, /sessionRequestIdRef\.current \+= 1/);
  assert.match(session, /setRestaurant\(null\)/);
  assert.match(session, /setMemberships\(\[\]\)/);
  assert.match(session, /AppState\.addEventListener\("change"/);
  assert.match(
    session,
    /captureMiseError\(error,\s*\{\s*flow:\s*"membership_revalidation"\s*\}\)[\s\S]*failClosedOnError[\s\S]*clearUnverifiedWorkspaceAccess[\s\S]*setWorkspaceAccessUnverified\(true\)/
  );
  assert.match(
    session,
    /setWorkspaceAccessUnverified\(false\)/
  );
});

test("repository permission failures trigger live membership revalidation", () => {
  const repository = source("services/repositories/miseRepository.ts");
  const events = source("services/tenantAuthorizationEvents.ts");

  assert.match(repository, /throwRepositoryError\(error, restaurantId\)/);
  assert.match(repository, /throwRepositoryError\(error, typeof body\.restaurantId/);
  assert.match(repository, /throwRepositoryError\(error, input\.restaurant_id\)/);
  assert.match(repository, /throwRepositoryError\(inventoryResult\.error, restaurantId\)/);
  assert.match(repository, /throwRepositoryError\(linesError, restaurantId\)/);
  assert.match(repository, /throwRepositoryError\(integration\.error, restaurantId\)/);
  assert.doesNotMatch(repository, /if \(error\) throw error;/);
  assert.doesNotMatch(repository, /if \(linesError\) throw linesError;/);
  assert.doesNotMatch(repository, /if \(inventoryResult\.error\) throw inventoryResult\.error;/);
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
