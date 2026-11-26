import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const restaurantId = "restaurant-tenant-denial";
const permissionError = {
  code: "42501",
  message: "permission denied for restaurant workspace"
};

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
  const fakeClient = {
    from(table: string) {
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
    rpc() {
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
        () => repository.fetchPOSStatus(restaurantId)
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

    assert.equal(notifications.length, 33);
    assert.ok(notifications.every((deniedRestaurantId) => deniedRestaurantId === restaurantId));
  } finally {
    delete require.cache[repositoryPath];
    delete require.cache[eventsPath];
    moduleLoader._load = originalLoad;
  }
});
