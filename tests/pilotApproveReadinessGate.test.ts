import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  repairDemoState
} from "../services/demo/replaceableDemoData";
import { buildPilotReadiness } from "../services/domain/pilotReadiness";
import { normalizeInventoryItem } from "../services/miseValidation";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("seeded demo restaurant satisfies canRecommend for the operating loop", () => {
  const state = createInitialDemoState("Toast", { preset: "default" });
  const countEvents = state.inventoryEvents.filter((event) => event.eventType === "count");
  assert.equal(countEvents.length, state.inventoryItems.length);

  const readiness = buildPilotReadiness({
    restaurantId: DEMO_RESTAURANT_ID,
    posIntegrations: state.posIntegrations,
    sales: state.posSales,
    inventoryItems: state.inventoryItems.map(normalizeInventoryItem),
    countEvents,
    recipeMappings: state.menuItemIngredients,
    supplierRecipients: state.supplierRecipients,
    emailConnection: state.emailConnections[0] ?? null
  });

  assert.equal(readiness.canRecommend, true);
  assert.equal(
    readiness.areas.find((area) => area.id === "inventory_counts")?.status,
    "ready"
  );
});

test("demo repair v14 adds missing physical counts without dropping waste history", () => {
  const seeded = createInitialDemoState("Toast", { preset: "default" });
  const wasteOnly = seeded.inventoryEvents.filter((event) => event.eventType === "waste");
  assert.ok(wasteOnly.length >= 5);

  const repaired = repairDemoState({
    ...seeded,
    schema_version: 13,
    inventoryEvents: wasteOnly
  });

  assert.equal(repaired.state.schema_version, 14);
  assert.equal(repaired.migrated, true);
  assert.equal(
    repaired.state.inventoryEvents.filter((event) => event.eventType === "waste").length,
    wasteOnly.length
  );
  assert.equal(
    repaired.state.inventoryEvents.filter((event) => event.eventType === "count").length,
    repaired.state.inventoryItems.length
  );
});

test("purchase recommendation approval revalidates pilot readiness before the RPC", async () => {
  const ordersApplication = await source("services/application/orders.ts");
  assert.match(ordersApplication, /fetchPilotReadiness\(normalizedRestaurantId\)/);
  assert.match(ordersApplication, /assertPilotCanRecommend\(readiness\)/);
  assert.match(ordersApplication, /PilotReadinessUnavailableError/);
  assert.match(
    ordersApplication,
    /Fail closed before the approval RPC: UI gates are not authorization/
  );
});

test("Home and Orders surface readiness-blocked approve failures", async () => {
  const [home, orders] = await Promise.all([
    source("app/(tabs)/home.tsx"),
    source("app/(tabs)/orders.tsx")
  ]);
  assert.match(home, /isPilotReadinessBlockedError\(approveError\)/);
  assert.match(home, /home\.approvals\.readinessBlocked/);
  assert.match(orders, /isPilotReadinessBlockedError\(error\)/);
  assert.match(orders, /orders\.error\.readinessBlocked/);
});
