import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryCountAuthorityRestaurantToken,
  canonicalizeInventoryCountAuthorityRestaurantId,
  requireCanonicalInventoryCountAuthorityWorkspaceId
} from "../services/domain/inventoryCountAuthorityRestaurantIdentity";
import {
  buildInventoryCountEvidence,
  type VerifiedCountCandidate
} from "../services/domain/inventoryCountAuthority";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryCountAuthorityRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/inventoryCountAuthority.ts", import.meta.url),
  "utf8"
);
const wasteAnalysisSource = readFileSync(
  new URL("../services/domain/wasteAnalysis.ts", import.meta.url),
  "utf8"
);
const supplierSpendSource = readFileSync(
  new URL("../services/domain/supplierSpend.ts", import.meta.url),
  "utf8"
);

const workspace = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "item-chicken";
const evaluatedAt = "2026-08-17T23:00:00.000Z";
const countedAt = "2026-08-17T12:00:00.000Z";

function countCandidate(restaurantId = workspace): VerifiedCountCandidate {
  return {
    id: "count-1",
    restaurantId,
    inventoryItemId: itemId,
    eventType: "count",
    effectiveAt: countedAt,
    quantity: 20,
    sequence: 1
  };
}

function evidence(restaurantId: string) {
  return buildInventoryCountEvidence({
    restaurantId,
    items: [{ id: itemId, canonical_quantity_per_unit: 1 }],
    ledgerEvents: [countCandidate(workspace)],
    generatedAt: evaluatedAt
  });
}

test("MISE-005MV pins inventoryCountAuthority restaurantId to ASCII C", () => {
  assert.match(identitySource, /MISE-005MV/);
  assert.match(domainSource, /MISE-005MV/);

  assert.match(
    identitySource,
    /export function asciiTrimInventoryCountAuthorityRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalInventoryCountAuthorityWorkspaceId\(input\.restaurantId\)/
  );
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /const restaurantId = input\.restaurantId\.trim\(\)/);

  // Leave waste-analysis (#777), supplier-spend (#776), and their helpers alone.
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierSpendRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /salesTrendsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /insightsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /ordersRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /findingsRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /deliveriesRestaurantIdentity/);

  // Sibling domain restaurant workspace Unicode trims remain for later tips.
  assert.match(wasteAnalysisSource, /restaurantId\.trim\(\)/);
  assert.match(supplierSpendSource, /restaurantId\.trim\(\)/);
});

test("ASCII trim keeps ordinary count-authority workspace padding stable", () => {
  assert.equal(asciiTrimInventoryCountAuthorityRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalInventoryCountAuthorityWorkspaceId(` ${workspace} `), workspace);

  const map = evidence(`  ${workspace}  `);
  const row = map.get(itemId);
  assert.ok(row);
  assert.equal(row.restaurantId, workspace);
  assert.equal(row.inventoryItemId, itemId);
  assert.equal(row.freshness, "fresh");
  assert.equal(row.countedAt, countedAt);
});

test("ASCII count-authority trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimInventoryCountAuthorityRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => evidence(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => evidence(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
});

test("Count-authority workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId(""), null);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId("   "), null);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeInventoryCountAuthorityRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalInventoryCountAuthorityWorkspaceId(undefined),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
  assert.throws(
    () => evidence(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Inventory count evidence requires a restaurant."
  );
});
