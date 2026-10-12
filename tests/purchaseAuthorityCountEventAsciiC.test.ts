import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityCountEventToken,
  canonicalizePurchaseAuthorityCountEventId,
  normalizeCanonicalPurchaseAuthorityCountEventId
} from "../services/domain/purchaseAuthorityCountEventIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityCountEventIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const countEventId = "count-1";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authorityInput(countEvent: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId: countEvent,
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

test("MISE-005NX pins purchase-authority countEventId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NX/);
  assert.match(domainSource, /MISE-005NX/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityCountEventToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const countEventId = normalizeCanonicalPurchaseAuthorityCountEventId\(\s*evidencePayload\.countEventId\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityCountEventIdentity"/);

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

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseLinesCreditsLineIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority countEventId padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityCountEventToken(`  ${countEventId}  `), countEventId);
  assert.equal(canonicalizePurchaseAuthorityCountEventId(`\t${countEventId}\n`), countEventId);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId(`  ${countEventId}  `), countEventId);

  const authority = authorityInput(`  ${countEventId}  `);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing countEventId remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityCountEventId(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.countEventId, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.countEventId, null);
});

test("NBSP and em-space padding cannot invent purchase-authority countEventId", () => {
  const nbspCount = `\u00a0${countEventId}\u00a0`;
  const emCount = `\u2003${countEventId}\u2003`;

  // Unicode trim invents an exact match against the unpadded count-event id.
  assert.equal(nbspCount.trim(), countEventId);
  assert.notEqual(asciiTrimPurchaseAuthorityCountEventToken(nbspCount), countEventId);
  assert.equal(canonicalizePurchaseAuthorityCountEventId(nbspCount), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountEventId(nbspCount),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );
  assert.throws(
    () => authorityInput(nbspCount),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );

  assert.equal(emCount.trim(), countEventId);
  assert.equal(canonicalizePurchaseAuthorityCountEventId(emCount), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountEventId(emCount),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );
  assert.throws(
    () => authorityInput(emCount),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
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
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.countEventId, countEventId);
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
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.countEventId, countEventId);
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
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.ready, true);
});

test("over-long and control purchase-authority countEventId values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityCountEventId(""), null);
  assert.equal(canonicalizePurchaseAuthorityCountEventId("   "), null);
  assert.equal(canonicalizePurchaseAuthorityCountEventId("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityCountEventId("count-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountEventId("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityCountEventId("count-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );
  assert.throws(
    () => authorityInput("count-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority countEventId is invalid."
  );
});
