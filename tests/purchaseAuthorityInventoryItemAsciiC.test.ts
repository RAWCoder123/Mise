import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityInventoryItemToken,
  canonicalizePurchaseAuthorityInventoryItemId,
  normalizeCanonicalPurchaseAuthorityInventoryItemId
} from "../services/domain/purchaseAuthorityInventoryItemIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityInventoryItemIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const inventoryItemId = "item-1";
const recommendationId = "rec-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authorityInput(inventoryItem: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId: inventoryItem,
      supplierId,
      countEventId: "count-1",
      countedAt: "2026-10-11T12:00:00.000Z",
      projectedQuantity: 2,
      canonicalUnit: "each",
      providerWindowFrom: null,
      providerWindowTo: null,
      providerWindowCompletedAt: null,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005NW pins purchase-authority inventoryItemId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NW/);
  assert.match(domainSource, /MISE-005NW/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityInventoryItemToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const inventoryItemId = normalizeCanonicalPurchaseAuthorityInventoryItemId\(\s*evidencePayload\.inventoryItemId\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityInventoryItemIdentity"/);

  // Leave sibling boundedString identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /recommendationId: boundedString\(evidencePayload\.recommendationId, 80\),/
  );
  assert.match(
    domainSource,
    /const supplierId = boundedString\(evidencePayload\.supplierId, 80\);/
  );
  assert.match(
    domainSource,
    /countEventId: nullableString\(evidencePayload\.countEventId, 80\),/
  );
  assert.match(
    domainSource,
    /canonicalUnit: nullableString\(evidencePayload\.canonicalUnit, 20\),/
  );
  assert.match(
    domainSource,
    /\.filter\(\(\[key, revision\]\) => Boolean\(boundedString\(key, 80\)\) && finiteInteger\(revision\) !== null\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLinesCreditsLineIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority inventoryItemId padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityInventoryItemToken(`  ${inventoryItemId}  `), inventoryItemId);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId(`\t${inventoryItemId}\n`), inventoryItemId);
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId(`  ${inventoryItemId}  `), inventoryItemId);

  const authority = authorityInput(`  ${inventoryItemId}  `);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing inventoryItemId remain empty string", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId("   "), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId("\t\n"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId("\u00a0\u00a0"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId(null), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId(undefined), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityInventoryItemId(12), "");

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.inventoryItemId, "");

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.inventoryItemId, "");
});

test("NBSP and em-space padding cannot invent purchase-authority inventoryItemId", () => {
  const nbspInventory = `\u00a0${inventoryItemId}\u00a0`;
  const emInventory = `\u2003${inventoryItemId}\u2003`;

  // Unicode trim invents an exact match against the unpadded inventory item id.
  assert.equal(nbspInventory.trim(), inventoryItemId);
  assert.notEqual(asciiTrimPurchaseAuthorityInventoryItemToken(nbspInventory), inventoryItemId);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId(nbspInventory), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityInventoryItemId(nbspInventory),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
  assert.throws(
    () => authorityInput(nbspInventory),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );

  assert.equal(emInventory.trim(), inventoryItemId);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId(emInventory), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityInventoryItemId(emInventory),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
  assert.throws(
    () => authorityInput(emInventory),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
});

test("sibling recommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecommendation = `\u00a0${recommendationId}\u00a0`;
  assert.equal(nbspRecommendation.trim(), recommendationId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId: nbspRecommendation,
      inventoryItemId,
      supplierId,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
});

test("sibling supplierId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspSupplier = `\u00a0${supplierId}\u00a0`;
  assert.equal(nbspSupplier.trim(), supplierId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId: nbspSupplier,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.ready, true);
});

test("sibling countEventId NBSP padding still invents under Unicode trim until tipped", () => {
  const countEventId = "count-1";
  const nbspCount = `\u00a0${countEventId}\u00a0`;
  assert.equal(nbspCount.trim(), countEventId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId: nbspCount,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
});

test("over-long and control purchase-authority inventoryItemId values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId(""), null);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId("   "), null);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityInventoryItemId("item-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityInventoryItemId("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityInventoryItemId("item-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
  assert.throws(
    () => authorityInput("item-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority inventoryItemId is invalid."
  );
});
