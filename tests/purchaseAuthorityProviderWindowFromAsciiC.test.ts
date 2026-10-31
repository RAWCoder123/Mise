import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityProviderWindowFrom,
  canonicalizePurchaseAuthorityProviderWindowFrom,
  normalizeCanonicalPurchaseAuthorityProviderWindowFrom
} from "../services/domain/purchaseAuthorityProviderWindowFromIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityProviderWindowFromIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const providerWindowFrom = "2026-08-01";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";
const countedAt = "2026-08-19T12:00:00.000Z";
const canonicalUnit = "each";
const providerWindowTo = "2026-08-28";
const providerWindowCompletedAt = "2026-08-28T18:00:00.000Z";

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
      countedAt,
      projectedQuantity: 2,
      canonicalUnit,
      providerWindowFrom: stamp,
      providerWindowTo,
      providerWindowCompletedAt,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005UU pins purchase-authority providerWindowFrom to ASCII C", () => {
  assert.match(identitySource, /MISE-005UU/);
  assert.match(domainSource, /MISE-005UU/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityProviderWindowFrom\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const providerWindowFrom = normalizeCanonicalPurchaseAuthorityProviderWindowFrom\(\s*evidencePayload\.providerWindowFrom\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityProviderWindowFromIdentity"/);

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
    /canonicalUnit: nullableString\(evidencePayload\.canonicalUnit, 20\),/
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
  assert.doesNotMatch(identitySource, /purchaseAuthorityCanonicalUnitIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityProviderWindowToIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityProviderWindowCompletedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCanonicalUnitIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityProviderWindowToIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityProviderWindowCompletedAtIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority providerWindowFrom padding stable", () => {
  assert.equal(
    asciiTrimPurchaseAuthorityProviderWindowFrom(`  ${providerWindowFrom}  `),
    providerWindowFrom
  );
  assert.equal(
    canonicalizePurchaseAuthorityProviderWindowFrom(`\t${providerWindowFrom}\n`),
    providerWindowFrom
  );
  assert.equal(
    normalizeCanonicalPurchaseAuthorityProviderWindowFrom(`  ${providerWindowFrom}  `),
    providerWindowFrom
  );

  const authority = authorityInput(`  ${providerWindowFrom}  `);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing providerWindowFrom remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowFrom(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.providerWindowFrom, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.providerWindowFrom, null);
});

test("NBSP and em-space padding cannot invent purchase-authority providerWindowFrom", () => {
  const nbspFrom = `\u00a0${providerWindowFrom}\u00a0`;
  const emFrom = `\u2003${providerWindowFrom}\u2003`;

  // Unicode trim invents an exact match against the unpadded provider-window start.
  assert.equal(nbspFrom.trim(), providerWindowFrom);
  assert.notEqual(asciiTrimPurchaseAuthorityProviderWindowFrom(nbspFrom), providerWindowFrom);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom(nbspFrom), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowFrom(nbspFrom),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
  assert.throws(
    () => authorityInput(nbspFrom),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );

  assert.equal(emFrom.trim(), providerWindowFrom);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom(emFrom), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowFrom(emFrom),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
  assert.throws(
    () => authorityInput(emFrom),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
});

test("sibling providerWindowTo NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspTo = `\u00a0${providerWindowTo}\u00a0`;
  assert.equal(nbspTo.trim(), providerWindowTo);

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
      providerWindowFrom,
      providerWindowTo: nbspTo,
      providerWindowCompletedAt,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
});

test("sibling providerWindowCompletedAt NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCompleted = `\u00a0${providerWindowCompletedAt}\u00a0`;
  assert.equal(nbspCompleted.trim(), providerWindowCompletedAt);

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
      providerWindowFrom,
      providerWindowTo,
      providerWindowCompletedAt: nbspCompleted,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
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
      providerWindowFrom,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
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
      providerWindowFrom,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
});

test("over-long and control purchase-authority providerWindowFrom values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom(""), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom("   "), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom("a".repeat(21)), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowFrom("2026-08-01\u0000"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowFrom("a".repeat(21)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowFrom("2026-08-01\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
  assert.throws(
    () => authorityInput("2026-08-01\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowFrom is invalid."
  );
});
