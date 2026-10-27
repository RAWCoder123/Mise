import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimDemoPurchaseRecommendationId,
  canonicalizeDemoPurchaseRecommendationId,
  normalizeCanonicalDemoPurchaseRecommendationId
} from "../services/domain/demoPurchaseRecommendationIdIdentity";
import {
  createInitialDemoState,
  repairDemoState,
  type StoredDemoState
} from "../services/demo/replaceableDemoData";

const identitySource = readFileSync(
  new URL("../services/domain/demoPurchaseRecommendationIdIdentity.ts", import.meta.url),
  "utf8"
);
const replaceableSource = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);
const restaurantTasksSource = readFileSync(
  new URL("../services/domain/restaurantTasks.ts", import.meta.url),
  "utf8"
);

const cleanId = "00000000-0000-4000-8000-000000000501";
const legacyToken = "rec_abc";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005SC pins demo purchase-recommendation id identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005SC/);
  assert.match(replaceableSource, /MISE-005SC/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoPurchaseRecommendationId\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    replaceableSource,
    /from "\.\.\/domain\/demoPurchaseRecommendationIdIdentity"/
  );
  assert.match(
    replaceableSource,
    /normalizeCanonicalDemoPurchaseRecommendationId\(\s*recommendation\.id\s*\)/
  );
  assert.match(
    replaceableSource,
    /const baseId = canonicalId \?\? `rec_legacy_\$\{index \+ 1\}`/
  );
  assert.doesNotMatch(replaceableSource, /recommendation\.id\?\.trim\(\)/);

  // Leave open #686 setup/lookup Unicode trim alone on main.
  const setupListStart = replaceableSource.indexOf("function normalizeSetupList(");
  assert.ok(setupListStart >= 0);
  const setupListBody = replaceableSource.slice(
    setupListStart,
    replaceableSource.indexOf("\nfunction ", setupListStart + 1)
  );
  assert.match(setupListBody, /\.map\(\(value\) => value\.trim\(\)\)/);
  assert.doesNotMatch(setupListBody, /normalizeCanonicalDemoPurchaseRecommendationId/);

  // Leave restaurant-tasks relatedRecommendationId inventing alone (open #814).
  assert.doesNotMatch(restaurantTasksSource, /demoPurchaseRecommendationIdIdentity/);
  assert.doesNotMatch(
    restaurantTasksSource,
    /normalizeCanonicalDemoPurchaseRecommendationId/
  );

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /restaurantTasksRelatedRecommendationIdentity/);
  assert.doesNotMatch(identitySource, /normalizeCanonicalRestaurantTasksRelatedRecommendationId/);
  assert.doesNotMatch(identitySource, /normalizeReplaceableDemoSetupKey/);
  assert.doesNotMatch(identitySource, /demoSupplierDisplayNameIdentity/);
  assert.doesNotMatch(replaceableSource, /restaurantTasksRelatedRecommendationIdentity/);
});

test("ASCII whitespace still trims clean for demo purchase-recommendation ids", () => {
  assert.equal(asciiTrimDemoPurchaseRecommendationId(`  ${cleanId}  `), cleanId);
  assert.equal(asciiTrimDemoPurchaseRecommendationId(`\t${legacyToken}\n`), legacyToken);
  assert.equal(canonicalizeDemoPurchaseRecommendationId(`  ${cleanId}  `), cleanId);
  assert.equal(
    normalizeCanonicalDemoPurchaseRecommendationId(`  ${cleanId}  `),
    cleanId
  );
  assert.equal(
    normalizeCanonicalDemoPurchaseRecommendationId(legacyToken),
    legacyToken
  );

  // Soft empty stays null (prior recommendation.id?.trim() empty → legacy).
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId(null), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId(undefined), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId(""), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId("   "), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId("\t\n"), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId(em), null);
  assert.equal(normalizeCanonicalDemoPurchaseRecommendationId(nbsp), null);
  assert.equal(canonicalizeDemoPurchaseRecommendationId(""), null);
  assert.equal(canonicalizeDemoPurchaseRecommendationId(em), null);
});

test("Unicode-padded demo purchase-recommendation ids fail closed instead of inventing", () => {
  // Prior Unicode trim invented a clean durable recommendation id.
  assert.equal(`${em}${legacyToken}${em}`.trim(), legacyToken);
  assert.throws(
    () => normalizeCanonicalDemoPurchaseRecommendationId(`${em}${legacyToken}${em}`),
    /Purchase recommendation id is invalid\./
  );
  assert.equal(
    canonicalizeDemoPurchaseRecommendationId(`${em}${legacyToken}${em}`),
    null
  );

  assert.equal(`${nbsp}${cleanId}${nbsp}`.trim(), cleanId);
  assert.throws(
    () => normalizeCanonicalDemoPurchaseRecommendationId(`${nbsp}${cleanId}${nbsp}`),
    /Purchase recommendation id is invalid\./
  );

  assert.throws(
    () => normalizeCanonicalDemoPurchaseRecommendationId(`${legacyToken}\u0000`),
    /Purchase recommendation id is invalid\./
  );
  assert.throws(
    () => normalizeCanonicalDemoPurchaseRecommendationId(42),
    /Purchase recommendation id is invalid\./
  );
});

test("repairDemoState uses ASCII-C recommendation ids and preserves soft-empty legacy ids", () => {
  const seeded = createInitialDemoState();
  const sample = seeded.purchaseRecommendations[0]!;
  assert.ok(sample);

  const paddedRaw: StoredDemoState = {
    ...seeded,
    schema_version: 13,
    purchaseRecommendations: [
      {
        ...sample,
        id: `${em}${sample.id}${em}` as typeof sample.id
      }
    ]
  };
  assert.throws(
    () => repairDemoState(paddedRaw),
    /Purchase recommendation id is invalid\./
  );

  const softEmptyRaw: StoredDemoState = {
    ...seeded,
    schema_version: 13,
    purchaseRecommendations: [
      {
        ...sample,
        id: em as typeof sample.id
      }
    ]
  };
  const softRepaired = repairDemoState(softEmptyRaw).state;
  assert.equal(softRepaired.purchaseRecommendations[0]?.id, "rec_legacy_1");

  const asciiPaddedRaw: StoredDemoState = {
    ...seeded,
    schema_version: 13,
    purchaseRecommendations: [
      {
        ...sample,
        id: `  ${sample.id}  ` as typeof sample.id
      }
    ]
  };
  const asciiRepaired = repairDemoState(asciiPaddedRaw).state;
  assert.equal(asciiRepaired.purchaseRecommendations[0]?.id, sample.id);

  const missingIdRaw: StoredDemoState = {
    ...seeded,
    schema_version: 13,
    purchaseRecommendations: [
      {
        ...sample,
        id: "" as typeof sample.id
      }
    ]
  };
  const missingRepaired = repairDemoState(missingIdRaw).state;
  assert.equal(missingRepaired.purchaseRecommendations[0]?.id, "rec_legacy_1");
});
