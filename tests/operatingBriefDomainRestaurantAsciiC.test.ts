import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimOperatingBriefDomainRestaurantToken,
  canonicalizeOperatingBriefDomainRestaurantId,
  requireCanonicalOperatingBriefDomainRestaurantId
} from "../services/domain/operatingBriefDomainRestaurantIdentity";
import { buildOperatingBrief } from "../services/domain/operatingBrief";
import type { Restaurant } from "../types/mise";

const identityPath = "services/domain/operatingBriefDomainRestaurantIdentity.ts";
const domainPath = "services/domain/operatingBrief.ts";

function restaurant(id: string): Restaurant {
  return {
    id,
    name: "Harbor Table",
    address: null,
    cuisine_type: "American",
    brand_color: "#B42318",
    accent_color: "#B42318",
    logo_url: null,
    service_style: "full_service",
    timezone: "America/New_York",
    currency: "USD",
    operational_profile: {
      serviceStyle: "full_service",
      orderCadence: ["Tue", "Fri"],
      prepWindows: ["AM"],
      primarySuppliers: ["Metro Produce"],
      inventoryReviewDays: ["daily"],
      notes: null
    },
    created_at: "2026-01-01T00:00:00.000Z"
  };
}

function emptyBriefInput(id: string) {
  return {
    restaurant: restaurant(id),
    operatingDate: "2026-10-30",
    generatedAt: "2026-10-30T12:00:00.000Z",
    sales: [],
    inventoryItems: [],
    recommendations: [],
    orders: [],
    insights: []
  };
}

test("MISE-005UN pins operating-brief domain restaurant workspace to ASCII C", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const domainSource = readFileSync(domainPath, "utf8");

  assert.match(identitySource, /MISE-005UN/);
  assert.match(domainSource, /MISE-005UN/);

  assert.match(
    identitySource,
    /export function asciiTrimOperatingBriefDomainRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    domainSource,
    /requireCanonicalOperatingBriefDomainRestaurantId\(input\.restaurant\.id\)/
  );
  assert.match(domainSource, /from "\.\/operatingBriefDomainRestaurantIdentity"/);

  // Leave prior Unicode restaurant.id.trim() removed from buildOperatingBrief.
  assert.doesNotMatch(domainSource, /input\.restaurant\.id\.trim\(\)/);

  // Do not import application operating-brief (#746) or daily-phase-brief (#747) modules.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*operatingBriefRestaurantIdentity["']|from ["'].*dailyPhaseBriefRestaurantIdentity["']|export function requireCanonicalOperatingBriefWorkspaceId/
  );
  assert.doesNotMatch(
    domainSource,
    /from ["'].*operatingBriefRestaurantIdentity["']|from ["'].*dailyPhaseBriefRestaurantIdentity["']/
  );

  // Preserve the domain error contract.
  assert.match(identitySource, /Operating brief requires a restaurant id\./);

  const workspace = "restaurant_a";
  assert.equal(asciiTrimOperatingBriefDomainRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(asciiTrimOperatingBriefDomainRestaurantToken(`\trestaurant_a\n`), workspace);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId(`  ${workspace}  `), workspace);
  assert.equal(requireCanonicalOperatingBriefDomainRestaurantId(`  ${workspace}  `), workspace);

  // Soft empty / Unicode-only space fail closed under the domain contract.
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId(""), null);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId("   "), null);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId("\u2003"), null);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId("\u00a0"), null);
  assert.throws(
    () => requireCanonicalOperatingBriefDomainRestaurantId(""),
    /Operating brief requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalOperatingBriefDomainRestaurantId("\u2003"),
    /Operating brief requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalOperatingBriefDomainRestaurantId(null),
    /Operating brief requires a restaurant id\./
  );
});

test("MISE-005UN refuses Unicode-trim inventing of clean operating-brief domain restaurant ids", () => {
  const padded = "\u2003restaurant_a\u2003";
  const nbsp = "\u00a0restaurant_a\u00a0";

  assert.equal(padded.trim(), "restaurant_a");
  assert.equal(nbsp.trim(), "restaurant_a");

  // ASCII C end trim leaves Unicode padding in place.
  assert.equal(asciiTrimOperatingBriefDomainRestaurantToken(padded), padded);
  assert.equal(asciiTrimOperatingBriefDomainRestaurantToken(nbsp), nbsp);

  // Canonicalize / require fail closed instead of inventing a clean workspace id.
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId(padded), null);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId(nbsp), null);
  assert.throws(
    () => requireCanonicalOperatingBriefDomainRestaurantId(padded),
    /Operating brief requires a restaurant id\./
  );
  assert.throws(
    () => requireCanonicalOperatingBriefDomainRestaurantId(nbsp),
    /Operating brief requires a restaurant id\./
  );

  // Control-bearing and over-long tokens fail closed.
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId("restaurant_a\u0000"), null);
  assert.equal(canonicalizeOperatingBriefDomainRestaurantId("x".repeat(129)), null);

  // buildOperatingBrief refuses padded restaurant ids instead of inventing scope.
  assert.throws(
    () => buildOperatingBrief(emptyBriefInput(padded)),
    /Operating brief requires a restaurant id\./
  );

  const brief = buildOperatingBrief(emptyBriefInput("  restaurant_a  "));
  assert.equal(brief.restaurantId, "restaurant_a");
});

test("MISE-005UN ownership boundaries stay separate from application operating-brief tip #746", () => {
  const identitySource = readFileSync(identityPath, "utf8");
  const domainSource = readFileSync(domainPath, "utf8");

  assert.match(identitySource, /Open application tip #746/);
  assert.match(identitySource, /Do not share with #746/);
  assert.doesNotMatch(domainSource, /Missing restaurant workspace/);
  assert.match(domainSource, /requireCanonicalOperatingBriefDomainRestaurantId/);
  // Domain path keeps its own error contract; application #746 owns Missing restaurant workspace.
  assert.match(identitySource, /Operating brief requires a restaurant id\./);
});
