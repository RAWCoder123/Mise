import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  asciiTrimPurchaseAuthorityEvaluatedAt,
  canonicalizePurchaseAuthorityEvaluatedAt,
  normalizeCanonicalPurchaseAuthorityEvaluatedAt
} from "../services/domain/purchaseAuthorityEvaluatedAtIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityEvaluatedAtIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const evaluatedAt = "2026-08-21T12:00:00.000Z";
const epochFallback = new Date(0).toISOString();
const recommendationId = "rec-1";
const inventoryItemId = "item-1";
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const countEventId = "count-1";

function authorityInput(stamp: unknown) {
  return normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt: stamp,
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt: "2026-08-19T12:00:00.000Z",
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

test("MISE-005UR pins purchase-authority evaluatedAt to ASCII C", () => {
  assert.match(identitySource, /MISE-005UR/);
  assert.match(domainSource, /MISE-005UR/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseAuthorityEvaluatedAt\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /const evaluatedAt = normalizeCanonicalPurchaseAuthorityEvaluatedAt\(\s*payload\.evaluatedAt\s*\)/
  );
  assert.match(domainSource, /from "\.\/purchaseAuthorityEvaluatedAtIdentity"/);
  assert.match(
    domainSource,
    /evaluatedAt: evaluatedAt \|\| new Date\(0\)\.toISOString\(\),/
  );

  // Leave sibling boundedString / nullableString identity surfaces on Unicode trim.
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
    /providerWindowCompletedAt: nullableString\(evidencePayload\.providerWindowCompletedAt, 80\),/
  );
  assert.match(
    domainSource,
    /\.filter\(\(\[key, revision\]\) => Boolean\(boundedString\(key, 80\)\) && finiteInteger\(revision\) !== null\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(identitySource, /purchaseAuthorityMetadataValueIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityDescriptionIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityCountEventIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityInventoryItemIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityRecommendationIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthoritySupplierIdentity/);
  assert.doesNotMatch(domainSource, /purchaseAuthorityMetadataValueIdentity/);
});

test("ASCII trim keeps ordinary purchase-authority evaluatedAt padding stable", () => {
  assert.equal(asciiTrimPurchaseAuthorityEvaluatedAt(`  ${evaluatedAt}  `), evaluatedAt);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt(`\t${evaluatedAt}\n`), evaluatedAt);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(`  ${evaluatedAt}  `), evaluatedAt);

  const authority = authorityInput(`  ${evaluatedAt}  `);
  assert.equal(authority.evaluatedAt, evaluatedAt);
  assert.equal(authority.evidence.recommendationId, recommendationId);
  assert.equal(authority.evidence.inventoryItemId, inventoryItemId);
  assert.equal(authority.evidence.supplierId, supplierId);
  assert.equal(authority.ready, true);
});

test("soft-empty and missing evaluatedAt fall through to the epoch fallback", () => {
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("   "), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("\t\n"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("\u00a0\u00a0"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("\u2003"), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(null), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(undefined), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(12), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(""), null);

  const softEmpty = authorityInput("   ");
  assert.equal(softEmpty.evaluatedAt, epochFallback);

  const unicodeSoft = authorityInput("\u2003");
  assert.equal(unicodeSoft.evaluatedAt, epochFallback);

  const missing = authorityInput(undefined);
  assert.equal(missing.evaluatedAt, epochFallback);
});

test("NBSP and em-space padding cannot invent purchase-authority evaluatedAt", () => {
  const nbspStamp = `\u00a0${evaluatedAt}\u00a0`;
  const emStamp = `\u2003${evaluatedAt}\u2003`;

  // Unicode trim invents an exact match against the unpadded evaluation stamp.
  assert.equal(nbspStamp.trim(), evaluatedAt);
  assert.notEqual(asciiTrimPurchaseAuthorityEvaluatedAt(nbspStamp), evaluatedAt);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt(nbspStamp), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(nbspStamp), null);
  assert.equal(authorityInput(nbspStamp).evaluatedAt, epochFallback);

  assert.equal(emStamp.trim(), evaluatedAt);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt(emStamp), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt(emStamp), null);
  assert.equal(authorityInput(emStamp).evaluatedAt, epochFallback);
});

test("sibling countEventId NBSP padding still invents under Unicode trim until tipped", () => {
  const nbspCount = `\u00a0${countEventId}\u00a0`;
  assert.equal(nbspCount.trim(), countEventId);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt,
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId: nbspCount,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countEventId, countEventId);
  assert.equal(authority.evaluatedAt, evaluatedAt);
});

test("sibling countedAt NBSP padding still invents under Unicode trim until tipped", () => {
  const countedAt = "2026-08-19T12:00:00.000Z";
  const nbspCounted = `\u00a0${countedAt}\u00a0`;
  assert.equal(nbspCounted.trim(), countedAt);

  const authority = normalizePurchaseAuthorityResult({
    ready: true,
    evaluatedAt,
    planningRevision: 3,
    blockers: [],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      countedAt: nbspCounted,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.evidence.countedAt, countedAt);
  assert.equal(authority.evaluatedAt, evaluatedAt);
});

test("sibling blocker description NBSP padding still invents under Unicode trim until tipped", () => {
  const description = "Need a fresh count before approval";
  const nbspDescription = `\u00a0${description}\u00a0`;
  assert.equal(nbspDescription.trim(), description);

  const authority = normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt,
    planningRevision: 3,
    blockers: [{
      code: "inventory_count_stale",
      description: nbspDescription,
      metadata: {}
    }],
    evidence: {
      recommendationId,
      inventoryItemId,
      supplierId,
      countEventId,
      recipeRevisions: {}
    }
  });
  assert.equal(authority.blockers[0]?.description, description);
  assert.equal(authority.evaluatedAt, evaluatedAt);
});

test("over-long and control purchase-authority evaluatedAt values soft-null to epoch", () => {
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt(""), null);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt("   "), null);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt("a".repeat(81)), null);
  assert.equal(canonicalizePurchaseAuthorityEvaluatedAt("2026-08-21T12:00:00.000Z\u0000"), null);

  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("a".repeat(81)), null);
  assert.equal(normalizeCanonicalPurchaseAuthorityEvaluatedAt("2026-08-21T12:00:00.000Z\u0000"), null);
  assert.equal(authorityInput("a".repeat(81)).evaluatedAt, epochFallback);
  assert.equal(authorityInput("2026-08-21T12:00:00.000Z\u0000").evaluatedAt, epochFallback);
});
