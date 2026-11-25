import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const restaurantId = "restaurant-tenant-denial";
const permissionError = {
  code: "42501",
  message: "permission denied for restaurant workspace"
};

function rejectedQuery(error: unknown) {
  const result = { data: null, error };
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

test("activity and Mise action authorization failures notify the active restaurant before rethrowing", async () => {
  const moduleLoader = require("node:module") as typeof import("node:module") & {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = moduleLoader._load;
  const fakeClient = {
    from() {
      return rejectedQuery(permissionError);
    },
    rpc() {
      return Promise.resolve({ data: null, error: permissionError });
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
        () => repository.listActivityEvents(restaurantId),
        () => repository.listMiseActions(restaurantId),
        () => repository.fetchSupplierSendAction!(restaurantId, "order-1"),
        () => repository.decideMiseAction(restaurantId, "action-1", "approved")
      ]) {
        await assert.rejects(operation(), (error) => error === permissionError);
      }
    } finally {
      unsubscribe();
    }

    assert.deepEqual(notifications, [
      restaurantId,
      restaurantId,
      restaurantId,
      restaurantId
    ]);
  } finally {
    delete require.cache[repositoryPath];
    delete require.cache[eventsPath];
    moduleLoader._load = originalLoad;
  }
});
