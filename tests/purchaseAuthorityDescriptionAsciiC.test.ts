import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseAuthorityResult } from "../services/domain/purchaseAuthority";
import {
  boundedCanonicalPurchaseAuthorityDescription,
  canonicalPurchaseAuthorityDescription
} from "../services/domain/purchaseAuthorityDescriptionIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseAuthorityDescriptionIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/purchaseAuthority.ts", import.meta.url),
  "utf8"
);

const FALLBACK = "Purchase evidence needs attention.";
const CLEAN = "Need a fresh count before approval";
const EM_PADDED = `\u2003${CLEAN}\u2003`;
const NBSP_PADDED = `\u00a0${CLEAN}\u00a0`;

test("MISE-005UQ pins purchase-authority blocker descriptions to ASCII C", () => {
  assert.match(identitySource, /MISE-005UQ/);
  assert.match(domainSource, /MISE-005UQ/);
  assert.match(
    domainSource,
    /from "\.\/purchaseAuthorityDescriptionIdentity"/
  );
  assert.match(
    domainSource,
    /boundedCanonicalPurchaseAuthorityDescription\(blocker\.description\)/
  );
  assert.doesNotMatch(
    domainSource,
    /description:\s*boundedString\(blocker\.description,\s*240\)\s*\|\|\s*"Purchase evidence needs attention\."/
  );

  // Leave sibling boundedString / metadata / durable-id surfaces alone.
  assert.match(domainSource, /function boundedString\(/);
  assert.doesNotMatch(
    identitySource,
    /normalizeCanonicalPurchaseAuthorityMetadataValue|purchaseAuthorityMetadataValueIdentity/
  );
});

test("MISE-005UQ inventing proof: Unicode trim invented a clean blocker description", () => {
  assert.equal(EM_PADDED.trim(), CLEAN);
  assert.notEqual(
    canonicalPurchaseAuthorityDescription(EM_PADDED),
    CLEAN,
    "ASCII C display-prep must not invent equality with the unpadded description"
  );
  assert.equal(
    canonicalPurchaseAuthorityDescription(NBSP_PADDED),
    CLEAN,
    "NBSP folds to plain space then ASCII-trims without inventing via Unicode trim of em-space"
  );
  assert.equal(canonicalPurchaseAuthorityDescription(CLEAN), CLEAN);
  assert.equal(
    canonicalPurchaseAuthorityDescription(`  ${CLEAN}\t\n`),
    CLEAN
  );
});

test("MISE-005UQ soft-fallback and normalizePurchaseAuthorityResult preserve contracts", () => {
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(""), FALLBACK);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription("\u2003"), FALLBACK);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription("\u00a0"), FALLBACK);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(null), FALLBACK);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(12), FALLBACK);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(CLEAN), CLEAN);
  assert.equal(
    boundedCanonicalPurchaseAuthorityDescription(EM_PADDED),
    EM_PADDED,
    "em-space padding is preserved as a distinct description, not invented clean"
  );
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(NBSP_PADDED), CLEAN);

  const overLong = `${"a".repeat(240)}EXTRA`;
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(overLong).length, 240);
  assert.equal(boundedCanonicalPurchaseAuthorityDescription(overLong), "a".repeat(240));

  const authority = normalizePurchaseAuthorityResult({
    ready: false,
    evaluatedAt: "2026-08-21T12:00:00.000Z",
    planningRevision: 1,
    blockers: [
      {
        code: "inventory_count_stale",
        description: EM_PADDED,
        metadata: {}
      },
      {
        code: "ordering_disabled",
        description: "\u2003",
        metadata: {}
      },
      {
        code: "supplier_missing",
        description: NBSP_PADDED,
        metadata: {}
      }
    ],
    evidence: {
      recommendationId: "rec-1",
      inventoryItemId: "item-1",
      recipeRevisions: {}
    }
  });

  assert.equal(authority.blockers.length, 3);
  assert.equal(authority.blockers[0]?.description, EM_PADDED);
  assert.notEqual(authority.blockers[0]?.description, CLEAN);
  assert.equal(authority.blockers[1]?.description, FALLBACK);
  assert.equal(authority.blockers[2]?.description, CLEAN);
});
