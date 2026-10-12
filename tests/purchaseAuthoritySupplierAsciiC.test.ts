import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthoritySupplierToken,
  canonicalizePurchaseAuthoritySupplierId,
  normalizeCanonicalPurchaseAuthoritySupplierId
} from "../services/domain/purchaseAuthoritySupplierIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthoritySupplierIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function authorityInput(supplier: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId: "rec-1",
      inventoryItemId: "item-1",
      supplierId: supplier,
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

test("MISE-005NU pins purchase-authority supplierId to ASCII C", () => {
  assert.match(identitySource, /MISE-005NU/);
  assert.match(domainSource, /MISE-005NU/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthoritySupplierToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const supplierId = normalizeCanonicalPurchaseAuthoritySupplierId\(\s*evidencePayload\.supplierId\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthoritySupplierIdentity"/);

  // Leave sibling boundedString identity surfaces on Unicode trim.
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
  assert.doesNotMatch(identitySource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(identitySource, /miseActionsApprovedByIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendation/);
  assert.doesNotMatch(domainSource, /purchaseLinesCreditsLineIdentity/);
  assert.doesNotMatch(domainSource, /miseActionsApprovedByIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority supplierId padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthoritySupplierToken(`  ${supplierId}  `), supplierId);
  assert.equal(canonicalizePurchaseAuthoritySupplierId(`\t${supplierId}\n`), supplierId);
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId(`  ${supplierId}  `), supplierId);

  const authority = authorityInput(`  ${supplierId}  `);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing supplierId remain empty string for readiness fail-closed", () => {
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId("   "), "");
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId("\t\n"), "");
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId("\u00a0\u00a0"), "");
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId(null), "");
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId(undefined), "");
  assert.equal(normalizeCanonicalPurchaseAuthoritySupplierId(12), "");

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.supplierId, "");
  assert.equal(softEmpty.ready, false);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.supplierId, "");
  assert.equal(missing.ready, false);
});

test("NBSP and em-space padding cannot invent purchase-authority supplierId", () => {
  const nbspSupplier = `\u00a0${supplierId}\u00a0`;
  const emSupplier = `\u2003${supplierId}\u2003`;

  // Unicode trim invents an exact match against the unpadded supplier id.
  assert.equal(nbspSupplier.trim(), supplierId);
  assert.notEqual(asciiTrimPurchaseAuthoritySupplierToken(nbspSupplier), supplierId);
  assert.equal(canonicalizePurchaseAuthoritySupplierId(nbspSupplier), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthoritySupplierId(nbspSupplier),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
  assert.throws(
    () => authorityInput(nbspSupplier),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );

  assert.equal(emSupplier.trim(), supplierId);
  assert.equal(canonicalizePurchaseAuthoritySupplierId(emSupplier), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthoritySupplierId(emSupplier),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
  assert.throws(
    () => authorityInput(emSupplier),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
});

test("sibling recommendationId NBSP padding still invents under Unicode trim until tipped", () => {
  const recommendationId = "rec-1";
  const nbspRecommendation = `\u00a0${recommendationId}\u00a0`;
  assert.equal(nbspRecommendation.trim(), recommendationId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: "2026-10-12T12:00:00.000Z",
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId: nbspRecommendation,
      inventoryItemId: "item-1",
      supplierId,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.supplierId, supplierId);
});

test("over-long and control purchase-authority supplierId values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthoritySupplierId(""), null);
  assert.equal(canonicalizePurchaseAuthoritySupplierId("   "), null);
  assert.equal(canonicalizePurchaseAuthoritySupplierId("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthoritySupplierId("supplier-\u0000id"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthoritySupplierId("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthoritySupplierId("supplier-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
  assert.throws(
    () => authorityInput("supplier-\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority supplierId is invalid."
  );
});
