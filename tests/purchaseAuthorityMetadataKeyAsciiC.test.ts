import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityMetadataKeyToken,
  canonicalizePurchaseAuthorityMetadataKey,
  normalizeCanonicalPurchaseAuthorityMetadataKey
} from "../services/domain/purchaseAuthorityMetadataKeyIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityMetadataKeyIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const metadataKey = "countedAt";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";
const recipeKey = "menu-1";

function authorityWithMetadata(metadata: Record<string, unknown>) {
  return normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [{
      code: "inventory_count_stale",
      description: "The physical inventory count is older than 36 hours.",
      metadata
    }],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt: "2026-10-11T12:00:00.000Z",
      projectedQuantity: 2,
      canonicalUnit: "each",
      providerWindowFrom: null,
      providerWindowTo: null,
      providerWindowCompletedAt: null,
      recipeRevisions: { [recipeKey]: 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005OJ pins purchase-authority metadata keys to ASCII C", () => {
  assert.match(identitySource, /MISE-005OJ/);
  assert.match(domainSource, /MISE-005OJ/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityMetadataKeyToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const safeKey = normalizeCanonicalPurchaseAuthorityMetadataKey\(key\);/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityMetadataKeyIdentity"/);

  // Leave sibling boundedString / nullableString identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /recommendationId: boundedString\(evidencePayload\.recommendationId, 80\),/
  );
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
    /countedAt: nullableString\(evidencePayload\.countedAt, 80\),/
  );
  assert.match(
    domainSource,
    /canonicalUnit: nullableString\(evidencePayload\.canonicalUnit, 20\),/
  );
  assert.match(
    domainSource,
    /\.filter\(\(\[key, revision\]\) => Boolean\(boundedString\(key, 80\)\) && finiteInteger\(revision\) !== null\)/
  );
  assert.match(
    domainSource,
    /else if \(typeof value === "string"\) safe\[safeKey\] = boundedString\(value, 120\);/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecipeRevisionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecipeRevisionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority metadata keys stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityMetadataKeyToken(`  ${metadataKey}  `), metadataKey);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey(`\t${metadataKey}\n`), metadataKey);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey(`  ${metadataKey}  `), metadataKey);

  const authority = authorityWithMetadata({ [`  ${metadataKey}  `]: "2026-10-11T12:00:00.000Z" });
  assert.deepEqual(authority.blockers[0]?.metadata, {
    [metadataKey]: "2026-10-11T12:00:00.000Z"
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
});

test("soft-empty metadata keys are omitted", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataKey(""), null);

  const softEmpty = authorityWithMetadata({
    "   ": "ignored",
    [metadataKey]: "2026-10-11T12:00:00.000Z"
  });
  assert.deepEqual(softEmpty.blockers[0]?.metadata, {
    [metadataKey]: "2026-10-11T12:00:00.000Z"
  });

  const unicodeOnly = authorityWithMetadata({ "\u00a0\u00a0": "ignored" });
  assert.deepEqual(unicodeOnly.blockers[0]?.metadata, {});
});

test("NBSP and em-space padding cannot invent purchase-authority metadata keys", () => {
  const nbspKey = `\u00a0${metadataKey}\u00a0`;
  const emKey = `\u2003${metadataKey}\u2003`;

  // Unicode trim invents an exact match against the unpadded metadata key.
  assert.equal(nbspKey.trim(), metadataKey);
  assert.notEqual(asciiTrimPurchaseAuthorityMetadataKeyToken(nbspKey), metadataKey);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey(nbspKey), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataKey(nbspKey),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ [nbspKey]: "2026-10-11T12:00:00.000Z" }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );

  assert.equal(emKey.trim(), metadataKey);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey(emKey), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataKey(emKey),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ [emKey]: "2026-10-11T12:00:00.000Z" }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
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
      countEventId,
      recipeRevisions: { [recipeKey]: 1 }
    }
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.deepEqual(authority.blockers, []);
});

test("sibling inventoryItemId NBSP padding still invents under Unicode trim until tipped", () => {
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
      countEventId,
      recipeRevisions: { [recipeKey]: 1 }
    }
  });
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
      countEventId,
      recipeRevisions: { [recipeKey]: 1 }
    }
  });
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("sibling countEventId NBSP padding still invents under Unicode trim until tipped", () => {
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
      recipeRevisions: { [recipeKey]: 1 }
    }
  });
  assert.equal(authority.evidence.countEventId, countEventId);
});

test("sibling recipe-revision key NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspRecipe = `\u00a0${recipeKey}\u00a0`;
  assert.equal(nbspRecipe.trim(), recipeKey);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      recipeRevisions: { [nbspRecipe]: 1 }
    }
  });
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
});

test("sibling metadata string value NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspValue = `\u00a0supplier-1\u00a0`;
  assert.equal(nbspValue.trim(), "supplier-1");

  const authority = authorityWithMetadata({ supplierId: nbspValue });
  assert.deepEqual(authority.blockers[0]?.metadata, { supplierId: "supplier-1" });
});

test("over-long and control purchase-authority metadata keys fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityMetadataKey(""), null);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey("   "), null);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey("a".repeat(61)), null);
  assert.equal(canonicalizePurchaseAuthorityMetadataKey("meta-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataKey("a".repeat(61)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataKey("meta-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ ["meta-\u0000id"]: "x" }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );

  // Over-long keys must not invent via silent truncation to 60 characters.
  const overLong = `meta-${"a".repeat(60)}`;
  assert.equal(overLong.length > 60, true);
  assert.equal(overLong.slice(0, 60).length, 60);
  assert.throws(
    () => authorityWithMetadata({ [overLong]: "x" }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata key is invalid."
  );
});
