import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityCountedAt,
  canonicalizePurchaseAuthorityCountedAt,
  normalizeCanonicalPurchaseAuthorityCountedAt
} from "../services/domain/purchaseAuthorityCountedAtIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityCountedAtIdentity.ts", import.meta.url),
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

function authorityInput(stamp: unknown) {
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
      countedAt: stamp,
      projectedQuantity: 2,
      canonicalUnit,
      providerWindowFrom: null,
      providerWindowTo: null,
      providerWindowCompletedAt: null,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005US pins purchase-authority countedAt to ASCII C", () => {
  assert.match(identitySource, /MISE-005US/);
  assert.match(domainSource, /MISE-005US/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityCountedAt\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const countedAt = normalizeCanonicalPurchaseAuthorityCountedAt\(\s*evidencePayload\.countedAt\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityCountedAtIdentity"/);

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
    /canonicalUnit: nullableString\(evidencePayload\.canonicalUnit, 20\),/
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
  assert.doesNotMatch(identitySource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataValueIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority countedAt padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityCountedAt(`  ${countedAt}  `), countedAt);
  assert.equal(canonicalizePurchaseAuthorityCountedAt(`\t${countedAt}\n`), countedAt);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt(`  ${countedAt}  `), countedAt);

  const authority = authorityInput(`  ${countedAt}  `);
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing countedAt remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountedAt(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.countedAt, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.countedAt, null);
});

test("NBSP and em-space padding cannot invent purchase-authority countedAt", () => {
  const nbspCounted = `\u00a0${countedAt}\u00a0`;
  const emCounted = `\u2003${countedAt}\u2003`;

  // Unicode trim invents an exact match against the unpadded count timestamp.
  assert.equal(nbspCounted.trim(), countedAt);
  assert.notEqual(asciiTrimPurchaseAuthorityCountedAt(nbspCounted), countedAt);
  assert.equal(canonicalizePurchaseAuthorityCountedAt(nbspCounted), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountedAt(nbspCounted),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
  assert.throws(
    () => authorityInput(nbspCounted),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );

  assert.equal(emCounted.trim(), countedAt);
  assert.equal(canonicalizePurchaseAuthorityCountedAt(emCounted), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountedAt(emCounted),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
  assert.throws(
    () => authorityInput(emCounted),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
});

test("sibling countEventId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCount = `\u00a0${countEventId}\u00a0`;
  assert.equal(nbspCount.trim(), countEventId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId: nbspCount,
      countedAt,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.countedAt, countedAt);
});

test("sibling canonicalUnit NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspUnit = `\u00a0${canonicalUnit}\u00a0`;
  assert.equal(nbspUnit.trim(), canonicalUnit);

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
      canonicalUnit: nbspUnit,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
  assert.equal(authority.evidence.countedAt, countedAt);
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
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evaluatedAt, evaluatedAt);
  assert.equal(authority.evidence.countedAt, countedAt);
});

test("over-long and control purchase-authority countedAt values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityCountedAt(""), null);
  assert.equal(canonicalizePurchaseAuthorityCountedAt("   "), null);
  assert.equal(canonicalizePurchaseAuthorityCountedAt("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityCountedAt("2026-08-19T12:00:00.000Z\u0000"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountedAt("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountedAt("2026-08-19T12:00:00.000Z\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
  assert.throws(
    () => authorityInput("2026-08-19T12:00:00.000Z\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countedAt is invalid."
  );
});
