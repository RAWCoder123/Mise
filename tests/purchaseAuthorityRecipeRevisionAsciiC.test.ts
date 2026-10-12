import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityRecipeRevisionToken,
  canonicalizePurchaseAuthorityRecipeRevisionKey,
  normalizeCanonicalPurchaseAuthorityRecipeRevisionKey
} from "../services/domain/purchaseAuthorityRecipeRevisionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityRecipeRevisionIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const recipeKey = "menu-1";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";

function authorityInput(recipeRevisions: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
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
      recipeRevisions,
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005NY pins purchase-authority recipe-revision keys to ASCII C", () => {
  assert.match(identitySource, /MISE-005NY/);
  assert.match(domainSource, /MISE-005NY/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityRecipeRevisionToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const canonicalKey = normalizeCanonicalPurchaseAuthorityRecipeRevisionKey\(key\);/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityRecipeRevisionIdentity"/);

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

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority recipe-revision keys stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityRecipeRevisionToken(`  ${recipeKey}  `), recipeKey);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey(`\t${recipeKey}\n`), recipeKey);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(`  ${recipeKey}  `), recipeKey);

  const authority = authorityInput({ [`  ${recipeKey}  `]: 1 });
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.ready, true);
});

test("soft-empty recipe-revision keys are omitted", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(""), null);

  const softEmpty = authorityInput({ "   ": 1, [recipeKey]: 2 });
  assert.deepEqual(softEmpty.evidence.recipeRevisions, { [recipeKey]: 2 });

  const unicodeOnly = authorityInput({ "\u00a0\u00a0": 1 });
  assert.deepEqual(unicodeOnly.evidence.recipeRevisions, {});
});

test("NBSP and em-space padding cannot invent purchase-authority recipe-revision keys", () => {
  const nbspKey = `\u00a0${recipeKey}\u00a0`;
  const emKey = `\u2003${recipeKey}\u2003`;

  // Unicode trim invents an exact match against the unpadded recipe-revision key.
  assert.equal(nbspKey.trim(), recipeKey);
  assert.notEqual(asciiTrimPurchaseAuthorityRecipeRevisionToken(nbspKey), recipeKey);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey(nbspKey), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(nbspKey),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );
  assert.throws(
    () => authorityInput({ [nbspKey]: 1 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );

  assert.equal(emKey.trim(), recipeKey);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey(emKey), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecipeRevisionKey(emKey),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );
  assert.throws(
    () => authorityInput({ [emKey]: 1 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
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
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
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
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
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
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
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
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
});

test("over-long and control purchase-authority recipe-revision keys fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey(""), null);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey("   "), null);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityRecipeRevisionKey("menu-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecipeRevisionKey("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityRecipeRevisionKey("menu-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );
  assert.throws(
    () => authorityInput({ ["menu-\u0000id"]: 1 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );

  // Over-long keys must not invent via silent truncation to 80 characters.
  const overLong = `menu-${"a".repeat(80)}`;
  assert.equal(overLong.length > 80, true);
  assert.equal(overLong.slice(0, 80).length, 80);
  assert.throws(
    () => authorityInput({ [overLong]: 1 }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority recipe revision key is invalid."
  );
});
