import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityRecommendationToken,
  canonicalizePurchaseAuthorityRecommendationId,
  normalizeCanonicalPurchaseAuthorityRecommendationId
} from "../services/domain/purchaseAuthorityRecommendationIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityRecommendationIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const recommendationId = "rec-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authorityInput(recommendation: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId: recommendation,
      inventoryItemId: "item-1",
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

test("MISE-005NV pins purchase-authority recommendationId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NV/);
  assert.match(domainSource, /MISE-005NV/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityRecommendationToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const recommendationId = normalizeCanonicalPurchaseAuthorityRecommendationId\(\s*evidencePayload\.recommendationId\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityRecommendationIdentity"/);

  // Leave sibling boundedString identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /inventoryItemId: boundedString\(evidencePayload\.inventoryItemId, 80\),/
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
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority recommendationId padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityRecommendationToken(`  ${recommendationId}  `), recommendationId);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId(`\t${recommendationId}\n`), recommendationId);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId(`  ${recommendationId}  `), recommendationId);

  const authority = authorityInput(`  ${recommendationId}  `);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing recommendationId remain empty string", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId("   "), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId("\t\n"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId("\u00a0\u00a0"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId(null), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId(undefined), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityRecommendationId(12), "");

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.recommendationId, "");

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.recommendationId, "");
});

test("NBSP and em-space padding cannot invent purchase-authority recommendationId", () => {
  const nbspRecommendation = `\u00a0${recommendationId}\u00a0`;
  const emRecommendation = `\u2003${recommendationId}\u2003`;

  // Unicode trim invents an exact match against the unpadded recommendation id.
  assert.equal(nbspRecommendation.trim(), recommendationId);
  assert.notEqual(asciiTrimPurchaseAuthorityRecommendationToken(nbspRecommendation), recommendationId);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId(nbspRecommendation), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecommendationId(nbspRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
  assert.throws(
    () => authorityInput(nbspRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );

  assert.equal(emRecommendation.trim(), recommendationId);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId(emRecommendation), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecommendationId(emRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
  assert.throws(
    () => authorityInput(emRecommendation),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
});

test("sibling inventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
  const inventoryItemId = "item-1";
  const nbspInventory = `\u00a0${inventoryItemId}\u00a0`;
  assert.equal(nbspInventory.trim(), inventoryItemId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId: nbspInventory,
      supplierId,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.recommendationId, recommendationId);
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
      inventoryItemId: "item-1",
      supplierId: nbspSupplier,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.ready, true);
});

test("over-long and control purchase-authority recommendationId values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityRecommendationId(""), null);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId("   "), null);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityRecommendationId("rec-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecommendationId("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecommendationId("rec-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
  assert.throws(
    () => authorityInput("rec-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recommendationId is invalid."
  );
});
