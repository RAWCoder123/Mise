import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimWasteAnalysisRestaurantToken,
  canonicalizeWasteAnalysisRestaurantId,
  requireCanonicalWasteAnalysisWorkspaceId
} from "../services/domain/wasteAnalysisRestaurantIdentity";
import { buildWasteAnalysis } from "../services/domain/wasteAnalysis";
import type { InventoryEvent } from "../services/domain/inventoryLedger";
import type { InventoryItem } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/wasteAnalysisRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/wasteAnalysis.ts", import.meta.url),
  "utf8"
);
const wasteApplicationSource = readFileSync(
  new URL("../services/application/waste.ts", import.meta.url),
  "utf8"
);
const supplierSpendSource = readFileSync(
  new URL("../services/domain/supplierSpend.ts", import.meta.url),
  "utf8"
);
const inventoryCountAuthoritySource = readFileSync(
  new URL("../services/domain/inventoryCountAuthority.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant-a";

function item(id: string, restaurantId = workspace): InventoryItem {
  return {
    id,
    restaurant_id: restaurantId,
    item_name: "Roma tomatoes",
    category: "Produce",
    unit: "lb",
    current_quantity: 20,
    par_level: 30,
    reorder_threshold: 8,
    estimated_unit_cost: 2.5,
    supplier_id: "10000000-0000-4000-8000-000000000013",
    supplier_name: "Supplier",
    last_updated: "2026-08-03T12:00:00.000Z",
    canonical_unit: "g",
    canonical_quantity_per_unit: 1000,
    canonical_unit_verification_status: "verified"
  };
}

function event(
  id: string,
  itemId: string,
  quantity: number,
  effectiveAt: string,
  restaurantId = workspace
): InventoryEvent {
  return {
    id,
    sequence: Number(id.replace(/\D/g, "")) || 1,
    restaurantId,
    inventoryItemId: itemId,
    eventType: "waste",
    quantity,
    canonicalUnit: "g",
    effectiveAt,
    recordedAt: effectiveAt,
    actorUserId: "user-a",
    source: "operator_waste",
    sourceReference: null,
    reasonCode: null,
    clientEventId: `client-${id}`,
    idempotencyKey: `inventory:${id}`,
    supersedesEventId: null,
    metadata: {}
  };
}

function analyze(restaurantId: string) {
  return buildWasteAnalysis({
    restaurantId,
    operatingDate: "2026-08-03",
    restaurantTimeZone: "America/New_York",
    inventoryItems: [item("tomatoes")],
    events: [event("waste-1", "tomatoes", 1000, "2026-08-03T15:00:00.000Z")]
  });
}

test("MISE-005MU pins wasteAnalysis restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MU/);
  assert.match(domainSource, /MISE-005MU/);

  assert.match(
    identitySource,
    /export function asciiTrimWasteAnalysisRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(domainSource, /requireCanonicalWasteAnalysisWorkspaceId\(input\.restaurantId\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave waste application (#751), supplier-spend (#776), and inventoryCountAuthority alone.
  assert.doesNotMatch(identitySource, /wasteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountAuthorityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);

  // Waste application tip owns application/waste.ts restaurant paths separately.
  assert.doesNotMatch(wasteApplicationSource, /requireCanonicalWasteAnalysisWorkspaceId/);
  assert.doesNotMatch(wasteApplicationSource, /MISE-005MU/);
  assert.match(wasteApplicationSource, /restaurantId\.trim\(\)/);

  // Sibling domain restaurant workspace Unicode trims remain for later tips.
  assert.match(supplierSpendSource, /restaurantId\.trim\(\)/);
  assert.match(inventoryCountAuthoritySource, /input\.restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary waste-analysis workspace padding stable", () => {
  assert.equal(asciiTrimWasteAnalysisRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeWasteAnalysisRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalWasteAnalysisWorkspaceId(` ${workspace} `), workspace);

  const summary = analyze(`  ${workspace}  `);
  assert.equal(summary.restaurantId, workspace);
  assert.equal(summary.eventCount, 1);
  assert.equal(summary.estimatedCost, 2.5);
});

test("ASCII waste-analysis trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimWasteAnalysisRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeWasteAnalysisRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => analyze(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeWasteAnalysisRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => analyze(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
});

test("Waste-analysis workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeWasteAnalysisRestaurantId(""), null);
  assert.equal(canonicalizeWasteAnalysisRestaurantId("   "), null);
  assert.equal(canonicalizeWasteAnalysisRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeWasteAnalysisRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalWasteAnalysisWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
  assert.throws(
    () => analyze(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Waste analysis requires a restaurant."
  );
});
