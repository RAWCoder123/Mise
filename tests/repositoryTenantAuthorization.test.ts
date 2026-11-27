import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  isTenantAuthorizationError,
  subscribeToTenantAuthorizationDenials,
  throwRepositoryError
} from "../services/tenantAuthorizationEvents";

const require = createRequire(import.meta.url);
const restaurantId = "restaurant-tenant-denial";
const permissionError = {
  code: "42501",
  message: "permission denied for restaurant workspace"
};

test("tenant authorization errors recognize every supported denial shape", () => {
  for (const error of [
    { status: 401 },
    { status: 403 },
    { context: { status: 401 } },
    { context: { status: 403 } },
    { code: "42501" },
    { code: "PGRST301" },
    { message: "Permission denied for relation inventory_items" },
    { message: "Access denied for this restaurant" },
    { message: "Not authenticated" },
    { message: "Invalid or expired user session" }
  ]) {
    assert.equal(isTenantAuthorizationError(error), true);
  }

  for (const error of [
    null,
    new Error("temporary database timeout"),
    { status: 500 },
    { code: "23505" },
    { message: "not authorized for this operation" }
  ]) {
    assert.equal(isTenantAuthorizationError(error), false);
  }
});

test("tenant authorization notification isolates listener and telemetry failures", () => {
  const listenerError = new Error("listener failed");
  const telemetryError = new Error("telemetry failed");
  const notifications: Array<string | null> = [];
  let reportedError: unknown;
  const originalWarn = console.warn;
  const originalSentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const originalAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
  delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  process.env.EXPO_PUBLIC_APP_ENV = "test";
  console.warn = (...args: unknown[]) => {
    reportedError = args[1];
    throw telemetryError;
  };
  const unsubscribeFailing = subscribeToTenantAuthorizationDenials(() => {
    throw listenerError;
  });
  const unsubscribeHealthy = subscribeToTenantAuthorizationDenials((deniedRestaurantId) => {
    notifications.push(deniedRestaurantId);
  });

  try {
    assert.throws(
      () => throwRepositoryError(permissionError, restaurantId),
      (error) => error === permissionError
    );
    assert.deepEqual(notifications, [restaurantId]);
    assert.equal(reportedError, listenerError);
  } finally {
    unsubscribeHealthy();
    unsubscribeFailing();
    console.warn = originalWarn;
    if (originalSentryDsn === undefined) delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    else process.env.EXPO_PUBLIC_SENTRY_DSN = originalSentryDsn;
    if (originalAppEnv === undefined) delete process.env.EXPO_PUBLIC_APP_ENV;
    else process.env.EXPO_PUBLIC_APP_ENV = originalAppEnv;
  }
});

function settledQuery(data: unknown, error: unknown) {
  const result = { data, error };
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "gte", "lte", "in"]) {
    query[method] = () => query;
  }
  query.maybeSingle = () => Promise.resolve(result);
  query.single = () => Promise.resolve(result);
  query.then = (
    onFulfilled: (value: typeof result) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

test("restaurant-scoped authorization failures notify the active restaurant before rethrowing", async () => {
  const moduleLoader = require("node:module") as typeof import("node:module") & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleLoader._load;
  let rejectRpc = true;
  let repositoryError: unknown = permissionError;
  let allowTaskRows = false;
  let allowDeliveryRows = false;
  let allowCountSessionRows = false;
  let allowPosIntegrationRows = false;
  const tableOverrides = new Map<string, { data: unknown; error: unknown }>();
  const rpcOverrides = new Map<string, { data: unknown; error: unknown }>();
  const clientCalls: string[] = [];
  const fakeClient = {
    from(table: string) {
      clientCalls.push(`table:${table}`);
      const override = tableOverrides.get(table);
      if (override) return settledQuery(override.data, override.error);
      if (allowTaskRows && table === "restaurant_tasks") return settledQuery([], null);
      if (allowPosIntegrationRows && table === "pos_integrations") {
        return settledQuery(null, null);
      }
      if (allowDeliveryRows && table === "supplier_deliveries") {
        return settledQuery(
          [
            {
              id: "delivery-1",
              restaurant_id: restaurantId,
              supplier_order_id: "order-1",
              status: "received",
              received_at: "2026-11-26T05:00:00.000Z",
              notes: null,
              created_at: "2026-11-26T05:00:00.000Z"
            }
          ],
          null
        );
      }
      if (allowCountSessionRows && table === "inventory_count_sessions") {
        return settledQuery({ id: "count-session-1" }, null);
      }
      return settledQuery(null, repositoryError);
    },
    rpc(functionName: string) {
      clientCalls.push(`rpc:${functionName}`);
      const override = rpcOverrides.get(functionName);
      if (override) return Promise.resolve(override);
      return Promise.resolve(
        rejectRpc
          ? { data: null, error: repositoryError }
          : { data: { id: "task-1" }, error: null }
      );
    }
  };

  moduleLoader._load = function patchedLoad(request, parent, isMain) {
    if (request === "../../lib/supabase") return { supabase: fakeClient };
    return originalLoad.call(this, request, parent, isMain);
  };
  const repositoryPath = require.resolve("../services/repositories/supabaseRepository");
  const eventsPath = require.resolve("../services/tenantAuthorizationEvents");
  delete require.cache[repositoryPath];
  delete require.cache[eventsPath];

  const notifications: Array<string | null> = [];
  try {
    const { subscribeToTenantAuthorizationDenials } = require(
      eventsPath
    ) as typeof import("../services/tenantAuthorizationEvents");
    const { createSupabaseRepository } = require(
      repositoryPath
    ) as typeof import("../services/repositories/supabaseRepository");
    const unsubscribe = subscribeToTenantAuthorizationDenials((deniedRestaurantId) => {
      notifications.push(deniedRestaurantId);
    });
    const repository = createSupabaseRepository();
    const assertAuthorizationNotification = async (operation: () => Promise<unknown>) => {
      const notificationsBeforeOperation = notifications.length;
      await assert.rejects(operation(), (error) => error === permissionError);
      assert.equal(notifications.length, notificationsBeforeOperation + 1);
    };

    try {
      for (const operation of [
        () => repository.fetchSupplierOrders(restaurantId),
        () => repository.fetchEmailConnectionState(restaurantId),
        () => repository.fetchPosIntegrations(restaurantId),
        () => repository.fetchAiInsights(restaurantId),
        () => repository.fetchInsights(restaurantId),
        () => repository.fetchInventoryItems(restaurantId),
        () => repository.fetchPurchaseRecommendations(restaurantId),
        () => repository.fetchPurchaseRecommendationAuthorities(restaurantId),
        () => repository.fetchRecommendationHistory(restaurantId),
        () => repository.fetchPurchaseDecisionPatterns(restaurantId),
        () => repository.fetchPurchaseLines(restaurantId),
        () => repository.fetchPurchaseLineNetByItem(restaurantId),
        () => repository.fetchSupplierDeliveryHistory(restaurantId),
        () => repository.fetchSupplierOrder(restaurantId, "order-1"),
        () => repository.fetchOpenInventoryCountSession(restaurantId),
        () => repository.listActivityEvents(restaurantId),
        () => repository.listMiseActions(restaurantId),
        () => repository.fetchSupplierSendAction!(restaurantId, "order-1"),
        () => repository.decideMiseAction(restaurantId, "action-1", "approved"),
        () => repository.listRestaurantMemories(restaurantId),
        () =>
          repository.updateRestaurantMemoryDecision(
            restaurantId,
            "memory-1",
            "confirmed"
          ),
        () => repository.listAutonomyRules(restaurantId),
        () =>
          repository.upsertAutonomyRule(restaurantId, {
            actionType: "create_task",
            operationalCategory: "tasks",
            maximumAutonomyLevel: 4,
            requiresApproval: false,
            enabled: true
          }),
        () => repository.listRestaurantTasks(restaurantId),
        () =>
          repository.createRestaurantTask({
            restaurantId,
            clientTaskId: "task-create-1",
            title: "Count the walk-in"
          }),
        () =>
          repository.completeRestaurantTask({
            restaurantId,
            taskId: "task-1",
            completionResult: "Count verified"
          }),
        () => repository.reopenRestaurantTask(restaurantId, "task-1"),
        () => repository.fetchPOSStatus(restaurantId),
        () => repository.fetchSquarePosIntegration(restaurantId),
        () => repository.fetchPosMappingReviewQueue(restaurantId)
      ]) {
        await assertAuthorizationNotification(operation);
      }

      allowPosIntegrationRows = true;
      await assertAuthorizationNotification(() => repository.fetchPOSStatus(restaurantId));
      allowPosIntegrationRows = false;

      allowDeliveryRows = true;
      await assertAuthorizationNotification(() =>
        repository.fetchSupplierDeliveryHistory(restaurantId)
      );
      allowDeliveryRows = false;

      allowCountSessionRows = true;
      await assertAuthorizationNotification(() =>
        repository.fetchOpenInventoryCountSession(restaurantId)
      );
      allowCountSessionRows = false;

      allowTaskRows = true;
      await assertAuthorizationNotification(() =>
        repository.listRestaurantTasks(restaurantId)
      );
      allowTaskRows = false;

      rejectRpc = false;
      for (const operation of [
        () =>
          repository.createRestaurantTask({
            restaurantId,
            clientTaskId: "task-create-2",
            title: "Verify the delivery"
          }),
        () =>
          repository.completeRestaurantTask({
            restaurantId,
            taskId: "task-1",
            completionResult: "Receipt verified"
          }),
        () => repository.reopenRestaurantTask(restaurantId, "task-1")
      ]) {
        await assertAuthorizationNotification(operation);
      }

      const bundleRestaurant = {
        id: restaurantId,
        name: "Bundle Restaurant",
        timezone: "America/Chicago"
      };
      const verifiedProviderMappingRow = {
        restaurant_id: restaurantId,
        external_catalog_item_id: "catalog-1",
        external_variation_id: "variation-1",
        menu_item_id: "menu-item-1",
        verification_status: "verified",
        effective_from: "2020-01-01T00:00:00.000Z",
        effective_to: null,
        pos_locations: {
          external_location_id: "location-1",
          status: "active",
          pos_integrations: { provider: "square", status: "connected" }
        },
        menu_items: { active: true }
      };
      const healthyBundleTables: Record<string, unknown> = {
        restaurants: bundleRestaurant,
        pos_integrations: [],
        supplier_items: [],
        ai_insights: [],
        inventory_items: [],
        purchase_recommendations: [],
        insights: [],
        menu_item_ingredients: [],
        pos_catalog_item_mappings: [verifiedProviderMappingRow]
      };
      const configureBundleResults = (
        failures: { tables?: Record<string, unknown>; rpcs?: Record<string, unknown> } = {}
      ) => {
        tableOverrides.clear();
        rpcOverrides.clear();
        for (const [table, data] of Object.entries(healthyBundleTables)) {
          tableOverrides.set(table, { data, error: null });
        }
        rpcOverrides.set("fetch_planning_sales", { data: [], error: null });
        for (const [table, error] of Object.entries(failures.tables ?? {})) {
          tableOverrides.set(table, { data: null, error });
        }
        for (const [functionName, error] of Object.entries(failures.rpcs ?? {})) {
          rpcOverrides.set(functionName, { data: null, error });
        }
        clientCalls.length = 0;
      };
      const authorizationDenial = (label: string) => ({
        code: "42501",
        message: `permission denied for ${label}`
      });
      const assertBundleDenial = async (
        operation: () => Promise<unknown>,
        failures: { tables?: Record<string, unknown>; rpcs?: Record<string, unknown> },
        expectedError: unknown,
        expectedCalls: string[],
        unreachedCalls: string[]
      ) => {
        configureBundleResults(failures);
        const notificationsBeforeBundle = notifications.length;
        await assert.rejects(operation(), (error) => error === expectedError);
        assert.equal(notifications.length, notificationsBeforeBundle + 1);
        assert.equal(notifications[notifications.length - 1], restaurantId);
        for (const call of expectedCalls) assert.ok(clientCalls.includes(call), call);
        for (const call of unreachedCalls) assert.ok(!clientCalls.includes(call), call);
      };
      const assertBundleNonAuthorizationFailure = async (
        operation: () => Promise<unknown>,
        failures: { tables?: Record<string, unknown>; rpcs?: Record<string, unknown> },
        expectedError: unknown
      ) => {
        configureBundleResults(failures);
        const notificationsBeforeBundle = notifications.length;
        await assert.rejects(operation(), (error) => error === expectedError);
        assert.equal(notifications.length, notificationsBeforeBundle);
      };

      const opsProfileTables = ["restaurants", "pos_integrations", "supplier_items", "ai_insights"];
      for (const table of opsProfileTables) {
        const denial = authorizationDenial(`ops profile ${table}`);
        await assertBundleDenial(
          () => repository.fetchRestaurantOpsProfile(restaurantId),
          { tables: { [table]: denial } },
          denial,
          opsProfileTables.map((name) => `table:${name}`),
          []
        );
      }
      const firstOpsDenial = authorizationDenial("ops profile restaurants first");
      await assertBundleDenial(
        () => repository.fetchRestaurantOpsProfile(restaurantId),
        {
          tables: {
            restaurants: firstOpsDenial,
            pos_integrations: authorizationDenial("ops profile pos second"),
            supplier_items: authorizationDenial("ops profile supplier second"),
            ai_insights: authorizationDenial("ops profile insights second")
          }
        },
        firstOpsDenial,
        opsProfileTables.map((name) => `table:${name}`),
        []
      );

      const restaurantDataResultTables = [
        "restaurants",
        "inventory_items",
        "purchase_recommendations",
        "insights",
        "menu_item_ingredients"
      ];
      for (const table of restaurantDataResultTables) {
        const denial = authorizationDenial(`restaurant data ${table}`);
        await assertBundleDenial(
          () => repository.fetchRestaurantData(restaurantId),
          { tables: { [table]: denial } },
          denial,
          ["rpc:fetch_planning_sales", ...restaurantDataResultTables.map((name) => `table:${name}`)],
          ["table:pos_catalog_item_mappings"]
        );
      }
      const restaurantDataSalesDenial = authorizationDenial("restaurant data planning sales");
      await assertBundleDenial(
        () => repository.fetchRestaurantData(restaurantId),
        {
          tables: { restaurants: authorizationDenial("restaurant data restaurants after sales") },
          rpcs: { fetch_planning_sales: restaurantDataSalesDenial }
        },
        restaurantDataSalesDenial,
        ["rpc:fetch_planning_sales"],
        ["table:pos_catalog_item_mappings"]
      );
      const restaurantDataMappingDenial = authorizationDenial("restaurant data provider mappings");
      await assertBundleDenial(
        () => repository.fetchRestaurantData(restaurantId),
        { tables: { pos_catalog_item_mappings: restaurantDataMappingDenial } },
        restaurantDataMappingDenial,
        [
          "rpc:fetch_planning_sales",
          ...restaurantDataResultTables.map((name) => `table:${name}`),
          "table:pos_catalog_item_mappings"
        ],
        []
      );

      const planningDataResultTables = ["inventory_items", "menu_item_ingredients", "restaurants"];
      for (const table of planningDataResultTables) {
        const denial = authorizationDenial(`planning data ${table}`);
        await assertBundleDenial(
          () => repository.fetchPlanningData(restaurantId),
          { tables: { [table]: denial } },
          denial,
          ["rpc:fetch_planning_sales", ...planningDataResultTables.map((name) => `table:${name}`)],
          ["table:pos_catalog_item_mappings"]
        );
      }
      const planningDataSalesDenial = authorizationDenial("planning data planning sales");
      await assertBundleDenial(
        () => repository.fetchPlanningData(restaurantId),
        {
          tables: { inventory_items: authorizationDenial("planning data inventory after sales") },
          rpcs: { fetch_planning_sales: planningDataSalesDenial }
        },
        planningDataSalesDenial,
        ["rpc:fetch_planning_sales"],
        ["table:pos_catalog_item_mappings"]
      );
      const planningDataMappingDenial = authorizationDenial("planning data provider mappings");
      await assertBundleDenial(
        () => repository.fetchPlanningData(restaurantId),
        { tables: { pos_catalog_item_mappings: planningDataMappingDenial } },
        planningDataMappingDenial,
        [
          "rpc:fetch_planning_sales",
          ...planningDataResultTables.map((name) => `table:${name}`),
          "table:pos_catalog_item_mappings"
        ],
        []
      );

      const verifiedMappingsDenial = authorizationDenial("verified provider mappings");
      await assertBundleDenial(
        () => repository.fetchVerifiedProviderMappings!(restaurantId),
        { tables: { pos_catalog_item_mappings: verifiedMappingsDenial } },
        verifiedMappingsDenial,
        ["table:pos_catalog_item_mappings"],
        ["rpc:fetch_planning_sales"]
      );

      const bundleTimeout = new Error("temporary bundle database timeout");
      for (const [operation, failures] of [
        [() => repository.fetchRestaurantOpsProfile(restaurantId), { tables: { ai_insights: bundleTimeout } }],
        [() => repository.fetchRestaurantData(restaurantId), { tables: { insights: bundleTimeout } }],
        [() => repository.fetchRestaurantData(restaurantId), { rpcs: { fetch_planning_sales: bundleTimeout } }],
        [() => repository.fetchRestaurantData(restaurantId), { tables: { pos_catalog_item_mappings: bundleTimeout } }],
        [() => repository.fetchPlanningData(restaurantId), { tables: { restaurants: bundleTimeout } }],
        [() => repository.fetchPlanningData(restaurantId), { rpcs: { fetch_planning_sales: bundleTimeout } }],
        [() => repository.fetchPlanningData(restaurantId), { tables: { pos_catalog_item_mappings: bundleTimeout } }],
        [() => repository.fetchVerifiedProviderMappings!(restaurantId), { tables: { pos_catalog_item_mappings: bundleTimeout } }]
      ] as Array<[() => Promise<unknown>, { tables?: Record<string, unknown>; rpcs?: Record<string, unknown> }]>) {
        await assertBundleNonAuthorizationFailure(operation, failures, bundleTimeout);
      }

      const notificationsBeforeHealthyBundles = notifications.length;
      configureBundleResults();
      const opsProfile = await repository.fetchRestaurantOpsProfile(restaurantId);
      assert.equal(opsProfile.restaurant.id, restaurantId);
      configureBundleResults();
      const restaurantData = await repository.fetchRestaurantData(restaurantId);
      assert.equal(restaurantData.restaurant.id, restaurantId);
      assert.deepEqual(restaurantData.providerMappings, [
        {
          restaurantId,
          sourcePos: "square",
          providerLocationId: "location-1",
          externalCatalogItemId: "catalog-1",
          externalVariationId: "variation-1",
          menuItemId: "menu-item-1"
        }
      ]);
      assert.ok(clientCalls.includes("table:pos_catalog_item_mappings"));
      configureBundleResults();
      const planningData = await repository.fetchPlanningData(restaurantId);
      assert.equal(planningData.timeZone, "America/Chicago");
      assert.equal(planningData.providerMappings.length, 1);
      configureBundleResults();
      assert.equal((await repository.fetchVerifiedProviderMappings!(restaurantId)).length, 1);
      assert.equal(notifications.length, notificationsBeforeHealthyBundles);
      tableOverrides.clear();
      rpcOverrides.clear();

      const nonAuthorizationError = new Error("temporary database timeout");
      repositoryError = nonAuthorizationError;
      rejectRpc = true;
      const notificationsBeforeNonAuthorizationFailure = notifications.length;
      await assert.rejects(
        repository.createRestaurantTask({
          restaurantId,
          clientTaskId: "task-create-3",
          title: "Retry the prep check"
        }),
        (error) => error === nonAuthorizationError
      );
      await assert.rejects(
        repository.fetchInventoryItems(restaurantId),
        (error) => error === nonAuthorizationError
      );
      assert.equal(notifications.length, notificationsBeforeNonAuthorizationFailure);
    } finally {
      unsubscribe();
    }

    const coreBundleDenialNotifications =
      4 + 1 + // ops profile: four result checks plus first-denial-wins
      5 + 1 + 1 + // restaurant data: result checks, planning-sales helper, mapping helper
      3 + 1 + 1 + // planning data: result checks, planning-sales helper, mapping helper
      1; // verified provider mappings public method
    assert.equal(coreBundleDenialNotifications, 18);
    assert.equal(notifications.length, 37 + coreBundleDenialNotifications);
    assert.ok(notifications.every((deniedRestaurantId) => deniedRestaurantId === restaurantId));
  } finally {
    delete require.cache[repositoryPath];
    delete require.cache[eventsPath];
    moduleLoader._load = originalLoad;
  }
});
