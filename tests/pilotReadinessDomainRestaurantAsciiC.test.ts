import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPilotReadinessDomainRestaurantToken,
  canonicalizePilotReadinessDomainRestaurantId,
  requireCanonicalPilotReadinessDomainRestaurantId
} from "../services/domain/pilotReadinessDomainRestaurantIdentity";
import { buildPilotReadiness } from "../services/domain/pilotReadiness";

const identityPath = "services/domain/pilotReadinessDomainRestaurantIdentity.ts";
const domainPath = "services/domain/pilotReadiness.ts";

function emptyReadinessInput(restaurantId: string) {
  return {
    restaurantId,
    generatedAt: "2026-10-31T12:00:00.000Z",
    posIntegrations: [],
    sales: [],
    inventoryItems: [],
    countEvents: [],
    recipeMappings: [],
    providerMappings: [],
    supplierRecipients: [],
    emailConnection: null
  };
}

test("MISE-005UZ pins pilot-readiness domain restaurant workspace to ASCII C", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const domainSource = readFileSync(domainPath, "utf8");

  assert.match(identitySource, /MISE-005UZ/);
  assert.match(domainSource, /MISE-005UZ/);

  assert.match(
    identitySource,
    /export function asciiTrimPilotReadinessDomainRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    domainSource,
    /requireCanonicalPilotReadinessDomainRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.match(domainSource, /from "\.\/pilotReadinessDomainRestaurantIdentity"/);

  // Leave prior Unicode restaurantId.trim() removed from buildPilotReadiness.
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);

  // Do not import application pilot-readiness (#745) restaurant identity module.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*pilotReadinessRestaurantIdentity["']|export function requireCanonicalPilotReadinessWorkspaceId/
  );
  assert.doesNotMatch(domainSource, /from ["'].*pilotReadinessRestaurantIdentity["']/);

  // Preserve the domain error contract.
  assert.match(identitySource, /Pilot readiness requires a restaurant id\./);

  const workspace = "restaurant_a";
  assert.equal(asciiTrimPilotReadinessDomainRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(asciiTrimPilotReadinessDomainRestaurantToken(`\trestaurant_a\n`), workspace);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId(`  ${workspace}  `), workspace);
  assert.equal(requireCanonicalPilotReadinessDomainRestaurantId(`  ${workspace}  `), workspace);

  // Soft empty / Unicode-only space fail closed under the domain contract.
  assert.equal(canonicalizePilotReadinessDomainRestaurantId(""), null);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId("   "), null);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId("\u2003"), null);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId("\u00a0"), null);
  assert.throws(
    () => requireCanonicalPilotReadinessDomainRestaurantId(""),
    /Pilot readiness requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalPilotReadinessDomainRestaurantId("\u2003"),
    /Pilot readiness requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalPilotReadinessDomainRestaurantId(null),
    /Pilot readiness requires a restaurant id\./
  );
});

test("MISE-005UZ refuses Unicode-trim inventing of clean pilot-readiness domain restaurant ids", () => {
  const padded = "\u2003restaurant_a\u2003";
  const nbsp = "\u00a0restaurant_a\u00a0";

  assert.equal(padded.trim(), "restaurant_a");
  assert.equal(nbsp.trim(), "restaurant_a");

  // ASCII C end trim leaves Unicode padding in place.
  assert.equal(asciiTrimPilotReadinessDomainRestaurantToken(padded), padded);
  assert.equal(asciiTrimPilotReadinessDomainRestaurantToken(nbsp), nbsp);

  // Canonicalize / require fail closed instead of inventing a clean workspace id.
  assert.equal(canonicalizePilotReadinessDomainRestaurantId(padded), null);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId(nbsp), null);
  assert.throws(
    () => requireCanonicalPilotReadinessDomainRestaurantId(padded),
    /Pilot readiness requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalPilotReadinessDomainRestaurantId(nbsp),
    /Pilot readiness requires a restaurant id\./
  );

  // Control-bearing and over-long tokens fail closed.
  assert.equal(canonicalizePilotReadinessDomainRestaurantId("restaurant_a\u0000"), null);
  assert.equal(canonicalizePilotReadinessDomainRestaurantId("x".repeat(129)), null);

  // buildPilotReadiness refuses padded restaurant ids instead of inventing scope.
  assert.throws(
    () => buildPilotReadiness(emptyReadinessInput(padded)),
    /Pilot readiness requires a restaurant id\./
  );

  const readiness = buildPilotReadiness(emptyReadinessInput("  restaurant_a  "));
  assert.equal(readiness.restaurantId, "restaurant_a");
});

test("MISE-005UZ ownership boundaries stay separate from application pilot-readiness tip #745", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const domainSource = readFileSync(domainPath, "utf8");

  assert.match(identitySource, /Open application tip #745/);
  assert.match(identitySource, /Do not share with #745/);
  assert.doesNotMatch(domainSource, /Missing restaurant workspace/);
  assert.match(domainSource, /requireCanonicalPilotReadinessDomainRestaurantId/);
  // Domain path keeps its own error contract; application #745 owns Missing restaurant workspace.
  assert.match(identitySource, /Pilot readiness requires a restaurant id\./);

  // Leave sibling pilot-readiness field tips alone on this path.
  assert.match(domainSource, /item\.supplier_id\.trim\(\)/);
  assert.match(domainSource, /sale\.item_name\.trim\(\)/);
});
