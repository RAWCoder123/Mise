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
  const fakeClient = {
    from(table: string) {
      if (allowTaskRows && table === "restaurant_tasks") return settledQuery([], null);
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

    try {
      for (const operation of [
        () => repository.fetchSupplierOrders(restaurantId),
        () => repository.fetchEmailConnectionState(restaurantId),
        () => repository.fetchPosIntegrations(restaurantId),
        () => repository.listActivityEvents(restaurantId),
        () => repository.listMiseActions(restaurantId),
        () => repository.fetchSupplierSendAction!(restaurantId, "order-1"),
        () => repository.decideMiseAction(restaurantId, "action-1", "approved"),
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
        () => repository.reopenRestaurantTask(restaurantId, "task-1")
      ]) {
        await assert.rejects(operation(), (error) => error === permissionError);
      }

      allowTaskRows = true;
      await assert.rejects(
        repository.listRestaurantTasks(restaurantId),
        (error) => error === permissionError
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
        await assert.rejects(operation(), (error) => error === permissionError);
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
      assert.equal(notifications.length, notificationsBeforeNonAuthorizationFailure);
    } finally {
      unsubscribe();
    }

    assert.equal(notifications.length, 15);
    assert.ok(notifications.every((deniedRestaurantId) => deniedRestaurantId === restaurantId));
  } finally {
    delete require.cache[repositoryPath];
    delete require.cache[eventsPath];
    moduleLoader._load = originalLoad;
  }
});
