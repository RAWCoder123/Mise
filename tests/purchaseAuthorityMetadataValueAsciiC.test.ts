import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityMetadataValueToken,
  canonicalizePurchaseAuthorityMetadataValue,
  normalizeCanonicalPurchaseAuthorityMetadataValue
} from "../services/domain/purchaseAuthorityMetadataValueIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityMetadataValueIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const metadataKey = "menuItemId";
const menuItemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
      code: "recipe_incomplete",
      description: "A mapped menu recipe has not been confirmed complete.",
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

test("MISE-005OK pins purchase-authority metadata string values to ASCII C", () => {
  assert.match(identitySource, /MISE-005OK/);
  assert.match(domainSource, /MISE-005OK/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityMetadataValueToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /safe\[safeKey\] = normalizeCanonicalPurchaseAuthorityMetadataValue\(value\);/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityMetadataValueIdentity"/);

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
    /const safeKey = boundedString\(key, 60\);/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataKeyIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecipeRevisionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataKeyIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecipeRevisionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority metadata string values stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityMetadataValueToken(`  ${menuItemId}  `), menuItemId);
  assert.equal(canonicalizePurchaseAuthorityMetadataValue(`\t${menuItemId}\n`), menuItemId);
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue(`  ${menuItemId}  `), menuItemId);

  const authority = authorityWithMetadata({ [metadataKey]: `  ${menuItemId}  ` });
  assert.deepEqual(authority.blockers[0]?.metadata, {
    [metadataKey]: menuItemId
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.deepEqual(authority.evidence.recipeRevisions, { [recipeKey]: 1 });
});

test("soft-empty metadata string values remain empty string", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue("   "), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue("\t\n"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue("\u00a0\u00a0"), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue(null), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue(undefined), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue(12), "");
  assert.equal(normalizeCanonicalPurchaseAuthorityMetadataValue(""), "");

  const softEmpty = authorityWithMetadata({
    [metadataKey]: "   ",
    menuItemName: "Tomato Soup"
  });
  assert.deepEqual(softEmpty.blockers[0]?.metadata, {
    [metadataKey]: "",
    menuItemName: "Tomato Soup"
  });

  const unicodeOnly = authorityWithMetadata({ [metadataKey]: "\u00a0\u00a0" });
  assert.deepEqual(unicodeOnly.blockers[0]?.metadata, {
    [metadataKey]: ""
  });
});

test("NBSP and em-space padding cannot invent purchase-authority metadata string values", () => {
  const nbspValue = `\u00a0${menuItemId}\u00a0`;
  const emValue = `\u2003${menuItemId}\u2003`;

  // Unicode trim invents an exact match against the unpadded metadata value.
  assert.equal(nbspValue.trim(), menuItemId);
  assert.notEqual(asciiTrimPurchaseAuthorityMetadataValueToken(nbspValue), menuItemId);
  assert.equal(canonicalizePurchaseAuthorityMetadataValue(nbspValue), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataValue(nbspValue),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ [metadataKey]: nbspValue }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );

  assert.equal(emValue.trim(), menuItemId);
  assert.equal(canonicalizePurchaseAuthorityMetadataValue(emValue), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataValue(emValue),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ [metadataKey]: emValue }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );
});

test("over-long and control-bearing metadata string values fail closed", () => {
  const overLong = `${menuItemId}${"x".repeat(200)}`;
  assert.equal(overLong.trim().slice(0, 120).length, 120);
  assert.equal(canonicalizePurchaseAuthorityMetadataValue(overLong), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataValue(overLong),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );
  assert.throws(
    () => authorityWithMetadata({ [metadataKey]: overLong }),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );

  const withControl = `${menuItemId}\u0007`;
  assert.equal(canonicalizePurchaseAuthorityMetadataValue(withControl), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityMetadataValue(withControl),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority metadata value is invalid."
  );
});

test("boolean number and null metadata values remain unchanged", () => {
  const authority = authorityWithMetadata({
    [metadataKey]: menuItemId,
    unattestedLineCount: 2,
    projectedQuantity: 1.5,
    flagged: true,
    optionalNote: null
  });
  assert.deepEqual(authority.blockers[0]?.metadata, {
    [metadataKey]: menuItemId,
    unattestedLineCount: 2,
    projectedQuantity: 1.5,
    flagged: true,
    optionalNote: null
  });
});

test("sibling metadata key NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspKey = `\u00a0${metadataKey}\u00a0`;
  assert.equal(nbspKey.trim(), metadataKey);

  const authority = authorityWithMetadata({ [nbspKey]: menuItemId });
  assert.deepEqual(authority.blockers[0]?.metadata, {
    [metadataKey]: menuItemId
  });
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
