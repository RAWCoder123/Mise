import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimRestaurantTasksHostedRestaurantToken,
  canonicalizeRestaurantTasksHostedRestaurantId,
  requireCanonicalRestaurantTasksHostedRestaurantId
} from "../services/repositories/restaurantTasksHostedRestaurantIdentity";

const identityPath = "services/repositories/restaurantTasksHostedRestaurantIdentity.ts";
const repositoryPath = "services/repositories/supabaseRepository.ts";

test("MISE-005VA pins hosted restaurant-tasks create/complete restaurant workspace to ASCII C", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const repositorySource = readFileSync(repositoryPath, "utf8");

  assert.match(identitySource, /MISE-005VA/);
  assert.match(repositorySource, /MISE-005VA/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantTasksHostedRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    repositorySource,
    /requireCanonicalRestaurantTasksHostedRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.match(
    repositorySource,
    /from "\.\/restaurantTasksHostedRestaurantIdentity"/
  );

  // Leave prior Unicode restaurantId.trim() removed from create/complete hosted paths.
  // Count createRestaurantTask / completeRestaurantTask blocks no longer use .trim().
  const createBlock = repositorySource.slice(
    repositorySource.indexOf("async createRestaurantTask(input)"),
    repositorySource.indexOf("async completeRestaurantTask(input)")
  );
  const completeBlock = repositorySource.slice(
    repositorySource.indexOf("async completeRestaurantTask(input)"),
    repositorySource.indexOf("async reopenRestaurantTask(")
  );
  assert.doesNotMatch(createBlock, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(completeBlock, /input\.restaurantId\.trim\(\)/);
  assert.match(createBlock, /requireCanonicalRestaurantTasksHostedRestaurantId/);
  assert.match(completeBlock, /requireCanonicalRestaurantTasksHostedRestaurantId/);

  // Do not import application restaurant-tasks (#739) restaurant identity module.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*restaurantTasksRestaurantIdentity["']|export function requireCanonicalRestaurantTasksWorkspaceId/
  );
  assert.doesNotMatch(
    repositorySource,
    /from ["'].*restaurantTasksRestaurantIdentity["']/
  );

  // Leave reopen and recalculation record siblings alone in this tip.
  const reopenBlock = repositorySource.slice(
    repositorySource.indexOf("async reopenRestaurantTask("),
    repositorySource.indexOf("async listRecalculationRuns(")
  );
  assert.doesNotMatch(reopenBlock, /requireCanonicalRestaurantTasksHostedRestaurantId/);
  const recordBlock = repositorySource.slice(
    repositorySource.indexOf("async recordRecalculationRun(input)"),
    repositorySource.indexOf("async listMiseActions(")
  );
  assert.match(recordBlock, /input\.restaurantId\.trim\(\)/);

  // Preserve the hosted scope-validation error contract.
  assert.match(
    identitySource,
    /Restaurant task failed restaurant scope validation\./
  );

  const workspace = "restaurant_a";
  assert.equal(
    asciiTrimRestaurantTasksHostedRestaurantToken(`  ${workspace}  `),
    workspace
  );
  assert.equal(
    asciiTrimRestaurantTasksHostedRestaurantToken(`\trestaurant_a\n`),
    workspace
  );
  assert.equal(
    canonicalizeRestaurantTasksHostedRestaurantId(`  ${workspace}  `),
    workspace
  );
  assert.equal(
    requireCanonicalRestaurantTasksHostedRestaurantId(`  ${workspace}  `),
    workspace
  );

  // Soft empty / Unicode-only space fail closed under the hosted contract.
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId(""), null);
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId("   "), null);
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId("\u2003"), null);
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId("\u00a0"), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId(""),
    /Restaurant task failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId("\u2003"),
    /Restaurant task failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId(null),
    /Restaurant task failed restaurant scope validation\./
  );
});

test("MISE-005VA refuses Unicode-trim inventing of clean hosted restaurant-tasks restaurant ids", () => {
  const padded = "\u2003restaurant_a\u2003";
  const nbsp = "\u00a0restaurant_a\u00a0";

  assert.equal(padded.trim(), "restaurant_a");
  assert.equal(nbsp.trim(), "restaurant_a");

  // ASCII C end trim leaves Unicode padding in place.
  assert.equal(asciiTrimRestaurantTasksHostedRestaurantToken(padded), padded);
  assert.equal(asciiTrimRestaurantTasksHostedRestaurantToken(nbsp), nbsp);

  // Canonicalize / require fail closed instead of inventing a clean workspace id.
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId(padded), null);
  assert.equal(canonicalizeRestaurantTasksHostedRestaurantId(nbsp), null);
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId(padded),
    /Restaurant task failed restaurant scope validation\./
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId(nbsp),
    /Restaurant task failed restaurant scope validation\./
  );

  // Controls and over-long tokens fail closed.
  assert.equal(
    canonicalizeRestaurantTasksHostedRestaurantId("restaurant_a\u0000"),
    null
  );
  assert.equal(
    canonicalizeRestaurantTasksHostedRestaurantId("r".repeat(129)),
    null
  );
  assert.throws(
    () => requireCanonicalRestaurantTasksHostedRestaurantId("restaurant_a\u0007"),
    /Restaurant task failed restaurant scope validation\./
  );
});
