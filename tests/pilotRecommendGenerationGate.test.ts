import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createInitialDemoState,
  DEMO_RESTAURANT_ID,
  repairDemoState
} from "../services/demo/replaceableDemoData";
import {
  assertPilotCanRecommend,
  buildPilotReadiness,
  isPilotReadinessBlockedError,
  PilotReadinessBlockedError
} from "../services/domain/pilotReadiness";
import { normalizeInventoryItem } from "../services/miseValidation";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("seeded demo restaurant satisfies canRecommend for recommendation generation", () => {
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
  assert.doesNotThrow(() => assertPilotCanRecommend(readiness));
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

test("assertPilotCanRecommend fails closed without physical-count evidence", () => {
  const state = createInitialDemoState("Toast", { preset: "default" });
  const readiness = buildPilotReadiness({
    restaurantId: DEMO_RESTAURANT_ID,
    posIntegrations: state.posIntegrations,
    sales: state.posSales,
    inventoryItems: state.inventoryItems.map(normalizeInventoryItem),
    countEvents: [],
    recipeMappings: state.menuItemIngredients,
    supplierRecipients: state.supplierRecipients,
    emailConnection: state.emailConnections[0] ?? null
  });

  assert.equal(readiness.canRecommend, false);
  assert.throws(() => assertPilotCanRecommend(readiness), PilotReadinessBlockedError);
  try {
    assertPilotCanRecommend(readiness);
  } catch (error) {
    assert.equal(isPilotReadinessBlockedError(error), true);
  }
});

test("purchase recommendation generation revalidates pilot readiness before writes", async () => {
  const [recalculations, inventoryApplication] = await Promise.all([
    source("services/application/recalculations.ts"),
    source("services/application/inventory.ts")
  ]);

  assert.match(recalculations, /requirePilotCanRecommend\(normalizedRestaurantId\)/);
  assert.match(
    recalculations,
    /Fail closed: unverified POS\/count\/recipe evidence must not create pending orders/
  );
  assert.match(
    recalculations,
    /publish an empty set when readiness is incomplete/
  );
  assert.match(inventoryApplication, /requirePilotCanRecommend\(normalizedRestaurantId\)/);
  assert.match(
    inventoryApplication,
    /Fail closed: manual add-to-order is still a purchase recommendation write/
  );
});

test("inventory detail surfaces readiness-blocked add-to-order failures", async () => {
  const [detail, catalog] = await Promise.all([
    source("app/inventory/[id].tsx"),
    source("i18n/catalog.ts")
  ]);

  assert.match(detail, /isPilotReadinessBlockedError\(error\)/);
  assert.match(detail, /inventory\.detail\.readinessBlocked/);
  assert.match(detail, /isPilotReadinessUnavailableError\(error\)/);
  assert.match(detail, /inventory\.detail\.readinessUnavailable/);
  assert.match(catalog, /"inventory\.detail\.readinessBlocked"/);
  assert.match(catalog, /"inventory\.detail\.readinessUnavailable"/);
});
