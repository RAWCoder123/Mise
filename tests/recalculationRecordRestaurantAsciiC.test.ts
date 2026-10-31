import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimRecalculationRecordRestaurantToken,
  canonicalizeRecalculationRecordRestaurantId,
  requireCanonicalRecalculationRecordRestaurantId
} from "../services/repositories/recalculationRecordRestaurantIdentity";

const identityPath = "services/repositories/recalculationRecordRestaurantIdentity.ts";
const repositoryPath = "services/repositories/supabaseRepository.ts";
const transportPath = "services/domain/recalculationRunTransport.ts";

test("MISE-005VB pins hosted recordRecalculationRun restaurant workspace to ASCII C", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const repositorySource = readFileSync(repositoryPath, "utf8");
  const transportSource = readFileSync(transportPath, "utf8");

  assert.match(identitySource, /MISE-005VB/);
  assert.match(repositorySource, /MISE-005VB/);

  assert.match(
    identitySource,
    /export function asciiTrimRecalculationRecordRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    repositorySource,
    /requireCanonicalRecalculationRecordRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.match(
    repositorySource,
    /from "\.\/recalculationRecordRestaurantIdentity"/
  );

  const recordBlock = repositorySource.slice(
    repositorySource.indexOf("async recordRecalculationRun(input)"),
    repositorySource.indexOf("async listMiseActions(")
  );
  assert.doesNotMatch(recordBlock, /input\.restaurantId\.trim\(\)/);
  assert.match(recordBlock, /requireCanonicalRecalculationRecordRestaurantId/);

  // Do not import transport (#734) restaurant identity module into this tip.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*recalculationRunTransportRestaurantIdentity["']|export function requireCanonicalRecalculationRunTransportRestaurantId/
  );
  assert.doesNotMatch(
    repositorySource,
    /from ["'].*recalculationRunTransportRestaurantIdentity["']/
  );

  // Leave transport RPC marshalling and hosted restaurant-tasks create/complete alone.
  assert.match(transportSource, /input\.restaurantId\.trim\(\)/);
  const createBlock = repositorySource.slice(
    repositorySource.indexOf("async createRestaurantTask(input)"),
    repositorySource.indexOf("async completeRestaurantTask(input)")
  );
  const completeBlock = repositorySource.slice(
    repositorySource.indexOf("async completeRestaurantTask(input)"),
    repositorySource.indexOf("async reopenRestaurantTask(")
  );
  assert.match(createBlock, /input\.restaurantId\.trim\(\)/);
  assert.match(completeBlock, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(createBlock, /requireCanonicalRecalculationRecordRestaurantId/);
  assert.doesNotMatch(completeBlock, /requireCanonicalRecalculationRecordRestaurantId/);

  // Preserve the hosted scope-validation error contract.
  assert.match(
    identitySource,
    /Recalculation run failed restaurant scope validation\./
  );

  const workspace = "restaurant_a";
  assert.equal(
    asciiTrimRecalculationRecordRestaurantToken(`  ${workspace}  `),
    workspace
  );
  assert.equal(
    asciiTrimRecalculationRecordRestaurantToken(`\trestaurant_a\n`),
    workspace
  );
  assert.equal(
    canonicalizeRecalculationRecordRestaurantId(`  ${workspace}  `),
    workspace
  );
  assert.equal(
    requireCanonicalRecalculationRecordRestaurantId(`  ${workspace}  `),
    workspace
  );

  // Soft empty / Unicode-only space fail closed under the hosted contract.
  assert.equal(canonicalizeRecalculationRecordRestaurantId(""), null);
  assert.equal(canonicalizeRecalculationRecordRestaurantId("   "), null);
  assert.equal(canonicalizeRecalculationRecordRestaurantId("\u2003"), null);
  assert.equal(canonicalizeRecalculationRecordRestaurantId("\u00a0"), null);
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId(""),
    /Recalculation run failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId("\u2003"),
    /Recalculation run failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId(null),
    /Recalculation run failed restaurant scope validation\./
  );
});

test("MISE-005VB refuses Unicode-trim inventing of clean hosted recalculation-record restaurant ids", () => {
  const padded = "\u2003restaurant_a\u2003";
  const nbsp = "\u00a0restaurant_a\u00a0";

  assert.equal(padded.trim(), "restaurant_a");
  assert.equal(nbsp.trim(), "restaurant_a");

  // ASCII C end trim leaves Unicode padding in place.
  assert.equal(asciiTrimRecalculationRecordRestaurantToken(padded), padded);
  assert.equal(asciiTrimRecalculationRecordRestaurantToken(nbsp), nbsp);

  // Canonicalize / require fail closed instead of inventing a clean workspace id.
  assert.equal(canonicalizeRecalculationRecordRestaurantId(padded), null);
  assert.equal(canonicalizeRecalculationRecordRestaurantId(nbsp), null);
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId(padded),
    /Recalculation run failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId(nbsp),
    /Recalculation run failed restaurant scope validation\./
  );

  // Controls and over-long tokens fail closed.
  assert.equal(
    canonicalizeRecalculationRecordRestaurantId("restaurant_a\u0000"),
    null
  );
  assert.equal(
    canonicalizeRecalculationRecordRestaurantId("r".repeat(129)),
    null
  );
  assert.throws(
    () => requireCanonicalRecalculationRecordRestaurantId("restaurant_a\u0007"),
    /Recalculation run failed restaurant scope validation\./
  );
});
