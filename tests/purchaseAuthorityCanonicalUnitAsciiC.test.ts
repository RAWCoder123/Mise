import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityCanonicalUnit,
  canonicalizePurchaseAuthorityCanonicalUnit,
  normalizeCanonicalPurchaseAuthorityCanonicalUnit
} from "../services/domain/purchaseAuthorityCanonicalUnitIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityCanonicalUnitIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const countedAt = "2026-08-19T12:00:00.000Z";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";
const canonicalUnit = "each";

function authorityInput(unit: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt,
      projectedQuantity: 2,
      canonicalUnit: unit,
      providerWindowFrom: null,
      providerWindowTo: null,
      providerWindowCompletedAt: null,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005UT pins purchase-authority canonicalUnit to ASCII C", () => {
  assert.match(identitySource, /MISE-005UT/);
  assert.match(domainSource, /MISE-005UT/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityCanonicalUnit\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const canonicalUnit = normalizeCanonicalPurchaseAuthorityCanonicalUnit\(\s*evidencePayload\.canonicalUnit\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityCanonicalUnitIdentity"/);

  // Leave sibling boundedString / nullableString identity surfaces on Unicode trim.
  assert.match(
    domainSource,
    /const evaluatedAt = boundedString\(payload\.evaluatedAt, 80\);/
  );
  assert.match(
    domainSource,
    /description: boundedString\(blocker\.description, 240\) \|\| "Purchase evidence needs attention\.",/
  );
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
    /providerWindowFrom: nullableString\(evidencePayload\.providerWindowFrom, 20\),/
  );
  assert.match(
    domainSource,
    /providerWindowTo: nullableString\(evidencePayload\.providerWindowTo, 20\),/
  );
  assert.match(
    domainSource,
    /providerWindowCompletedAt: nullableString\(evidencePayload\.providerWindowCompletedAt, 80\),/
  );
  assert.match(
    domainSource,
    /\.filter\(\(\[key, revision\]\) => Boolean\(boundedString\(key, 80\)\) && finiteInteger\(revision\) !== null\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataValueIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority canonicalUnit padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityCanonicalUnit(`  ${canonicalUnit}  `), canonicalUnit);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit(`\t${canonicalUnit}\n`), canonicalUnit);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit(`  ${canonicalUnit}  `), canonicalUnit);

  const authority = authorityInput(`  ${canonicalUnit}  `);
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing canonicalUnit remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCanonicalUnit(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.canonicalUnit, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.canonicalUnit, null);
});

test("NBSP and em-space padding cannot invent purchase-authority canonicalUnit", () => {
  const nbspUnit = `\u00a0${canonicalUnit}\u00a0`;
  const emUnit = `\u2003${canonicalUnit}\u2003`;

  // Unicode trim invents an exact match against the unpadded unit token.
  assert.equal(nbspUnit.trim(), canonicalUnit);
  assert.notEqual(asciiTrimPurchaseAuthorityCanonicalUnit(nbspUnit), canonicalUnit);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit(nbspUnit), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCanonicalUnit(nbspUnit),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
  assert.throws(
    () => authorityInput(nbspUnit),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );

  assert.equal(emUnit.trim(), canonicalUnit);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit(emUnit), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCanonicalUnit(emUnit),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
  assert.throws(
    () => authorityInput(emUnit),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
});

test("sibling countedAt NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCounted = `\u00a0${countedAt}\u00a0`;
  assert.equal(nbspCounted.trim(), countedAt);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt: nbspCounted,
      canonicalUnit,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
});

test("sibling providerWindowFrom NBSP padding still invents under Unicode trim until tipped", () => {
  const windowFrom = "2026-08-01";
  const nbspFrom = `\u00a0${windowFrom}\u00a0`;
  assert.equal(nbspFrom.trim(), windowFrom);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt,
      canonicalUnit,
      providerWindowFrom: nbspFrom,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.providerWindowFrom, windowFrom);
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
});

test("sibling evaluatedAt NBSP padding still invents under Unicode trim until tipped", () => {
  const evaluatedAt = "2026-08-21T12:00:00.000Z";
  const nbspEvaluated = `\u00a0${evaluatedAt}\u00a0`;
  assert.equal(nbspEvaluated.trim(), evaluatedAt);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: nbspEvaluated,
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt,
      canonicalUnit,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evaluatedAt, evaluatedAt);
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
});

test("over-long and control purchase-authority canonicalUnit values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit(""), null);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit("   "), null);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit("a".repeat(21)), null);
  assert.equal(canonicalizePurchaseAuthorityCanonicalUnit("each\u0000"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCanonicalUnit("a".repeat(21)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCanonicalUnit("each\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
  assert.throws(
    () => authorityInput("each\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority canonicalUnit is invalid."
  );
});
