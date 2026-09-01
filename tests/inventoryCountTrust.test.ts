import assert from "node:assert/strict";
import test from "node:test";

import {
  inventoryCountTrustAllowsStockClaims,
  summarizeInventoryCountTrust
} from "../services/domain/inventoryCountTrust";

test("summarizeInventoryCountTrust fails closed when evidence is missing", () => {
  const unavailable = summarizeInventoryCountTrust(null);
  assert.equal(unavailable.state, "unavailable");
  assert.equal(inventoryCountTrustAllowsStockClaims(unavailable), false);

  const empty = summarizeInventoryCountTrust([]);
  assert.equal(empty.state, "empty");
  assert.equal(inventoryCountTrustAllowsStockClaims(empty), false);
});

test("summarizeInventoryCountTrust prefers contaminated and unverified over all-clear", () => {
  const contaminated = summarizeInventoryCountTrust([
    { countEvidence: "contaminated_projection", countFreshness: "unverified" },
    { countEvidence: "verified_count", countFreshness: "fresh" }
  ]);
  assert.equal(contaminated.state, "contaminated");
  assert.equal(contaminated.contaminatedCount, 1);
  assert.equal(inventoryCountTrustAllowsStockClaims(contaminated), false);

  const unverified = summarizeInventoryCountTrust([
    { countEvidence: "no_verified_count", countFreshness: "unverified" },
    { countEvidence: "no_verified_count", countFreshness: "unverified" },
    { countEvidence: "verified_count", countFreshness: "fresh" }
  ]);
  assert.equal(unverified.state, "unverified");
  assert.equal(unverified.unverifiedCount, 2);
  assert.equal(inventoryCountTrustAllowsStockClaims(unverified), false);
});

test("summarizeInventoryCountTrust marks majority-stale catalogs as stale", () => {
  const stale = summarizeInventoryCountTrust([
    { countEvidence: "verified_count", countFreshness: "stale" },
    { countEvidence: "verified_count", countFreshness: "stale" },
    { countEvidence: "verified_count", countFreshness: "fresh" }
  ]);
  assert.equal(stale.state, "stale");
  assert.equal(stale.staleCount, 2);
  assert.equal(stale.freshCount, 1);
  assert.equal(inventoryCountTrustAllowsStockClaims(stale), false);
});

test("summarizeInventoryCountTrust allows stock claims when mostly fresh", () => {
  const authoritative = summarizeInventoryCountTrust([
    { countEvidence: "verified_count", countFreshness: "fresh" },
    { countEvidence: "verified_count", countFreshness: "fresh" },
    { countEvidence: "verified_count", countFreshness: "stale" }
  ]);
  assert.equal(authoritative.state, "authoritative");
  assert.equal(authoritative.freshCount, 2);
  assert.equal(inventoryCountTrustAllowsStockClaims(authoritative), true);
});
