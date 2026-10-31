import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityProviderWindowTo,
  canonicalizePurchaseAuthorityProviderWindowTo,
  normalizeCanonicalPurchaseAuthorityProviderWindowTo
} from "../services/domain/purchaseAuthorityProviderWindowToIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityProviderWindowToIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const providerWindowTo = "2026-08-28";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";
const countedAt = "2026-08-19T12:00:00.000Z";
const canonicalUnit = "each";
const providerWindowFrom = "2026-08-01";
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
      providerWindowFrom,
      providerWindowTo: stamp,
      providerWindowCompletedAt,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005UV pins purchase-authority providerWindowTo to ASCII C", () => {
  assert.match(identitySource, /MISE-005UV/);
  assert.match(domainSource, /MISE-005UV/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityProviderWindowTo\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const providerWindowTo = normalizeCanonicalPurchaseAuthorityProviderWindowTo\(\s*evidencePayload\.providerWindowTo\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityProviderWindowToIdentity"/);

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
    /providerWindowFrom: nullableString\(evidencePayload\.providerWindowFrom, 20\),/
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
  assert.doesNotMatch(identitySource, /purchaseAuthorityProviderWindowFromIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCanonicalUnitIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityProviderWindowCompletedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityProviderWindowFromIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCanonicalUnitIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityEvaluatedAtIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityProviderWindowCompletedAtIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority providerWindowTo padding stable", () => {
  assert.equal(
    asciiTrimPurchaseAuthorityProviderWindowTo(`  ${providerWindowTo}  `),
    providerWindowTo
  );
  assert.equal(
    canonicalizePurchaseAuthorityProviderWindowTo(`\t${providerWindowTo}\n`),
    providerWindowTo
  );
  assert.equal(
    normalizeCanonicalPurchaseAuthorityProviderWindowTo(`  ${providerWindowTo}  `),
    providerWindowTo
  );

  const authority = authorityInput(`  ${providerWindowTo}  `);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing providerWindowTo remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowTo(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.providerWindowTo, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.providerWindowTo, null);
});

test("NBSP and em-space padding cannot invent purchase-authority providerWindowTo", () => {
  const nbspTo = `\u00a0${providerWindowTo}\u00a0`;
  const emTo = `\u2003${providerWindowTo}\u2003`;

  // Unicode trim invents an exact match against the unpadded provider-window end.
  assert.equal(nbspTo.trim(), providerWindowTo);
  assert.notEqual(asciiTrimPurchaseAuthorityProviderWindowTo(nbspTo), providerWindowTo);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo(nbspTo), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowTo(nbspTo),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
  assert.throws(
    () => authorityInput(nbspTo),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );

  assert.equal(emTo.trim(), providerWindowTo);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo(emTo), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowTo(emTo),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
  assert.throws(
    () => authorityInput(emTo),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
});

test("sibling providerWindowFrom NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspFrom = `\u00a0${providerWindowFrom}\u00a0`;
  assert.equal(nbspFrom.trim(), providerWindowFrom);

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
      providerWindowTo,
      providerWindowCompletedAt,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.providerWindowFrom, providerWindowFrom);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
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
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
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
      providerWindowTo,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
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
      providerWindowTo,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
});

test("over-long and control purchase-authority providerWindowTo values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo(""), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo("   "), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo("a".repeat(21)), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowTo("2026-08-28\u0000"), null);

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowTo("a".repeat(21)),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowTo("2026-08-28\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
  assert.throws(
    () => authorityInput("2026-08-28\u0000"),
    (error: unknown) =>
      error instanceof Error && error.message === "Purchase authority providerWindowTo is invalid."
  );
});
