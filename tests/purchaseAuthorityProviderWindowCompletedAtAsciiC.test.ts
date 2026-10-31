import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityProviderWindowCompletedAt,
  canonicalizePurchaseAuthorityProviderWindowCompletedAt,
  normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt
} from "../services/domain/purchaseAuthorityProviderWindowCompletedAtIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityProviderWindowCompletedAtIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const providerWindowCompletedAt = "2026-08-28T18:00:00.000Z";
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";
const countedAt = "2026-08-19T12:00:00.000Z";
const canonicalUnit = "each";
const providerWindowFrom = "2026-08-01";
const providerWindowTo = "2026-08-28";

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
      providerWindowTo,
      providerWindowCompletedAt: stamp,
      recipeRevisions: { "menu-1": 1 },
      demandBasis: "manual_physical_stock"
    }
  });
}

test("MISE-005UW pins purchase-authority providerWindowCompletedAt to ASCII C", () => {
  assert.match(identitySource, /MISE-005UW/);
  assert.match(domainSource, /MISE-005UW/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityProviderWindowCompletedAt\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const providerWindowCompletedAt = normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt\(\s*evidencePayload\.providerWindowCompletedAt\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityProviderWindowCompletedAtIdentity"/);

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
    /providerWindowTo: nullableString\(evidencePayload\.providerWindowTo, 20\),/
  );
  assert.match(
    domainSource,
    /\.filter\(\(\[key, revision\]\) => Boolean\(boundedString\(key, 80\)\) && finiteInteger\(revision\) !== null\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityProviderWindowToIdentity/);
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
  assert.doesNotMatch(domainSource, /purchaseAuthorityProviderWindowToIdentity/);
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
});

test("ASCII trim keeps ordinary purchase-authority providerWindowCompletedAt padding stable", () => {
  assert.equal(
    asciiTrimPurchaseAuthorityProviderWindowCompletedAt(`  ${providerWindowCompletedAt}  `),
    providerWindowCompletedAt
  );
  assert.equal(
    canonicalizePurchaseAuthorityProviderWindowCompletedAt(`\t${providerWindowCompletedAt}\n`),
    providerWindowCompletedAt
  );
  assert.equal(
    normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(`  ${providerWindowCompletedAt}  `),
    providerWindowCompletedAt
  );

  const authority = authorityInput(`  ${providerWindowCompletedAt}  `);
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evidence.providerWindowTo, providerWindowTo);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing providerWindowCompletedAt remain null", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evidence.providerWindowCompletedAt, null);

  const missing = authorityInput(undefined);
  assert.equal(missing.evidence.providerWindowCompletedAt, null);
});

test("NBSP and em-space padding cannot invent purchase-authority providerWindowCompletedAt", () => {
  const nbspCompleted = `\u00a0${providerWindowCompletedAt}\u00a0`;
  const emCompleted = `\u2003${providerWindowCompletedAt}\u2003`;

  // Unicode trim invents an exact match against the unpadded completion stamp.
  assert.equal(nbspCompleted.trim(), providerWindowCompletedAt);
  assert.notEqual(
    asciiTrimPurchaseAuthorityProviderWindowCompletedAt(nbspCompleted),
    providerWindowCompletedAt
  );
  assert.equal(canonicalizePurchaseAuthorityProviderWindowCompletedAt(nbspCompleted), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(nbspCompleted),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );
  assert.throws(
    () => authorityInput(nbspCompleted),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );

  assert.equal(emCompleted.trim(), providerWindowCompletedAt);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowCompletedAt(emCompleted), null);
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(emCompleted),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );
  assert.throws(
    () => authorityInput(emCompleted),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
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
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
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
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
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
      providerWindowCompletedAt,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
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
      providerWindowCompletedAt,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.canonicalUnit, canonicalUnit);
  assert.equal(authority.evidence.providerWindowCompletedAt, providerWindowCompletedAt);
});

test("over-long and control purchase-authority providerWindowCompletedAt values fail closed", () => {
  assert.equal(canonicalizePurchaseAuthorityProviderWindowCompletedAt(""), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowCompletedAt("   "), null);
  assert.equal(canonicalizePurchaseAuthorityProviderWindowCompletedAt("a".repeat(81)), null);
  assert.equal(
    canonicalizePurchaseAuthorityProviderWindowCompletedAt("2026-08-28T18:00:00.000Z\u0000"),
    null
  );

  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt("a".repeat(81)),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );
  assert.throws(
    () => normalizeCanonicalPurchaseAuthorityProviderWindowCompletedAt(
      "2026-08-28T18:00:00.000Z\u0000"
    ),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );
  assert.throws(
    () => authorityInput("2026-08-28T18:00:00.000Z\u0000"),
    (error: unknown) =>
      error instanceof Error
      && error.message === "Purchase authority providerWindowCompletedAt is invalid."
  );
});
