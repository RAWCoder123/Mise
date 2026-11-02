import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createInitialDemoState } from "../services/demoData";
import {
  buildDemoReadinessSummary,
  buildSetupReadinessSummary
} from "../services/domain/miseDomain";
import {
  asciiTrimDemoReadinessCuisine,
  canonicalizeDemoReadinessCuisine,
  normalizeDemoReadinessCuisine
} from "../services/domain/presentationDemoReadinessCuisineIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/presentationDemoReadinessCuisineIdentity.ts", import.meta.url),
  "utf8"
);
const miseDomainSource = readFileSync(
  new URL("../services/domain/miseDomain.ts", import.meta.url),
  "utf8"
);
const insightsSource = readFileSync(
  new URL("../app/(tabs)/insights.tsx", import.meta.url),
  "utf8"
);
const settingsSource = readFileSync(
  new URL("../app/(tabs)/settings.tsx", import.meta.url),
  "utf8"
);

const cuisineLabel = "Coastal Seafood";
const accentedCuisine = "Café Provençal";
const FALLBACK = "Cuisine not set";
const MISSING = "cuisine/service style";
const em = "\u2003";
const nbsp = "\u00a0";

test("MISE-005VY pins miseDomain demo/setup readiness cuisine_type to ASCII C", () => {
  assert.match(identitySource, /MISE-005VY/);
  assert.match(miseDomainSource, /MISE-005VY/);

  assert.match(
    identitySource,
    /export function asciiTrimDemoReadinessCuisine\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Cuisine tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimDemoReadinessCuisine("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    miseDomainSource,
    /from "\.\/presentationDemoReadinessCuisineIdentity"/
  );
  assert.match(miseDomainSource, /normalizeDemoReadinessCuisine\(/);
  assert.match(
    miseDomainSource,
    /restaurant\.name\.trim\(\) && demoReadinessCuisine \? "ready" : "attention"/
  );
  assert.match(
    miseDomainSource,
    /demoReadinessCuisine \?\? "Cuisine not set"/
  );
  assert.match(
    miseDomainSource,
    /!setupReadinessCuisine \? "cuisine\/service style"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /restaurant\.cuisine_type\?\.trim\(\) \? "ready"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /evidence: restaurant\.cuisine_type \?\? "Cuisine not set"/
  );
  assert.doesNotMatch(
    miseDomainSource,
    /!restaurant\.cuisine_type\?\.trim\(\) \? "cuisine\/service style"/
  );

  // Leave sibling cuisine presentation tips alone.
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationInsightsSubtitleCuisineIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationSettingsWorkspaceCuisineIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*restaurantCuisineTypeIdentity/
  );
  assert.doesNotMatch(identitySource, /^import /m);
  // Insights subtitle and Settings workspace still use their own ?? paths on main.
  assert.match(
    insightsSource,
    /serviceLabel \?\? restaurant\.cuisine_type \?\? t\("settings\.profile\.cuisineFallback"\)/
  );
  assert.match(
    settingsSource,
    /item\.cuisine_type \?\? t\("settings\.workspace\.metaFallback"\)/
  );
});

test("ASCII C prep keeps ordinary miseDomain readiness cuisine_type stable", () => {
  assert.equal(asciiTrimDemoReadinessCuisine(`  ${cuisineLabel}  `), cuisineLabel);
  assert.equal(asciiTrimDemoReadinessCuisine(`\t${cuisineLabel}\n`), cuisineLabel);
  assert.equal(canonicalizeDemoReadinessCuisine(`  ${cuisineLabel}  `), cuisineLabel);
  assert.equal(normalizeDemoReadinessCuisine(`  ${cuisineLabel}  `), cuisineLabel);
  assert.equal(normalizeDemoReadinessCuisine(accentedCuisine), accentedCuisine);
});

test("Unicode-only space and empty string bypass Cuisine not set via ?? until ASCII C soft-null restores it", () => {
  const emOnly = em;
  const nbspOnly = nbsp;
  const paddedSpaces = "   ";
  const empty = "";

  // Prior truthy / `??` bypass proofs.
  assert.equal(Boolean(emOnly), true);
  assert.equal(Boolean(emOnly.trim()), false);
  assert.equal(emOnly ?? FALLBACK, emOnly);
  assert.notEqual(emOnly ?? FALLBACK, FALLBACK);
  assert.equal(empty ?? FALLBACK, empty);
  assert.notEqual(empty ?? FALLBACK, FALLBACK);

  assert.equal(normalizeDemoReadinessCuisine(emOnly), null);
  assert.equal(normalizeDemoReadinessCuisine(emOnly) ?? FALLBACK, FALLBACK);
  assert.equal(Boolean(normalizeDemoReadinessCuisine(emOnly)), false);
  assert.equal(normalizeDemoReadinessCuisine(nbspOnly), null);
  assert.equal(normalizeDemoReadinessCuisine(paddedSpaces), null);
  assert.equal(normalizeDemoReadinessCuisine(empty), null);
  assert.equal(normalizeDemoReadinessCuisine(null), null);
  assert.equal(normalizeDemoReadinessCuisine(undefined), null);
  assert.equal(normalizeDemoReadinessCuisine(null) ?? FALLBACK, FALLBACK);
});

test("NBSP/em-space padding cannot invent clean miseDomain readiness cuisine_type", () => {
  const emCuisine = `${em}${cuisineLabel}${em}`;
  const nbspCuisine = `${nbsp}${cuisineLabel}${nbsp}`;

  // Inventing proof on Unicode trim.
  assert.equal(emCuisine.trim(), cuisineLabel);
  assert.equal(nbspCuisine.trim(), cuisineLabel);

  // Cuisine tips preserve NBSP: ASCII trim leaves Unicode padding alone.
  assert.equal(asciiTrimDemoReadinessCuisine(emCuisine), emCuisine);
  assert.equal(asciiTrimDemoReadinessCuisine(nbspCuisine), nbspCuisine);

  // Soft-null refuses to invent clean cuisine display / readiness.
  assert.equal(canonicalizeDemoReadinessCuisine(emCuisine), null);
  assert.equal(canonicalizeDemoReadinessCuisine(nbspCuisine), null);
  assert.equal(normalizeDemoReadinessCuisine(emCuisine), null);
  assert.equal(normalizeDemoReadinessCuisine(nbspCuisine), null);
  assert.equal(normalizeDemoReadinessCuisine(emCuisine) ?? FALLBACK, FALLBACK);
});

test("Unsafe single-line controls soft-null for miseDomain readiness cuisine_type", () => {
  assert.equal(normalizeDemoReadinessCuisine(`${cuisineLabel}\u0000`), null);
  assert.equal(normalizeDemoReadinessCuisine(`\u0007${cuisineLabel}`), null);
  assert.equal(normalizeDemoReadinessCuisine(`${cuisineLabel}\u007f`), null);
  // Single-line cuisine labels reject embedded LF/CR.
  assert.equal(normalizeDemoReadinessCuisine(`${cuisineLabel}\nnext`), null);
  assert.equal(normalizeDemoReadinessCuisine(`${cuisineLabel}\rmore`), null);
  // Trailing ASCII whitespace still trims clean.
  assert.equal(normalizeDemoReadinessCuisine(`${cuisineLabel}\t`), cuisineLabel);
  assert.equal(normalizeDemoReadinessCuisine("Coastal Seafood"), cuisineLabel);
});

test("buildDemoReadinessSummary fails closed on Unicode-only-space cuisine_type", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  assert.ok(restaurant.name.trim(), "demo restaurant must keep a named profile for this proof");

  const unicodeOnly = buildDemoReadinessSummary(
    { ...restaurant, cuisine_type: em },
    state.posSales,
    state.inventoryItems,
    [],
    [],
    state.menuItemIngredients,
    []
  );
  const profile = unicodeOnly.checks.find((check) => check.id === "profile");
  assert.equal(profile?.status, "attention");
  assert.equal(profile?.evidence, FALLBACK);

  const padded = buildDemoReadinessSummary(
    { ...restaurant, cuisine_type: `${em}${cuisineLabel}${em}` },
    state.posSales,
    state.inventoryItems,
    [],
    [],
    state.menuItemIngredients,
    []
  );
  assert.equal(padded.checks.find((check) => check.id === "profile")?.status, "attention");
  assert.equal(padded.checks.find((check) => check.id === "profile")?.evidence, FALLBACK);

  const clean = buildDemoReadinessSummary(
    { ...restaurant, cuisine_type: cuisineLabel },
    state.posSales,
    state.inventoryItems,
    [],
    [],
    state.menuItemIngredients,
    []
  );
  assert.equal(clean.checks.find((check) => check.id === "profile")?.status, "ready");
  assert.equal(clean.checks.find((check) => check.id === "profile")?.evidence, cuisineLabel);
});

test("buildSetupReadinessSummary fails closed on Unicode-padded cuisine_type", () => {
  const state = createInitialDemoState("Toast");
  const restaurant = state.restaurants[0]!;
  const inventoryItems = state.inventoryItems.filter((item) => item.restaurant_id === restaurant.id);
  const mappings = state.menuItemIngredients.filter(
    (mapping) => mapping.restaurant_id === restaurant.id
  );

  const unicodeOnly = buildSetupReadinessSummary({
    restaurant: { ...restaurant, cuisine_type: em },
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: null
  });
  assert.ok(unicodeOnly.steps.find((step) => step.id === "profile")?.missing.includes(MISSING));

  const padded = buildSetupReadinessSummary({
    restaurant: { ...restaurant, cuisine_type: `${em}${cuisineLabel}${em}` },
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: null
  });
  assert.ok(padded.steps.find((step) => step.id === "profile")?.missing.includes(MISSING));

  const clean = buildSetupReadinessSummary({
    restaurant: { ...restaurant, cuisine_type: cuisineLabel },
    sales: state.posSales,
    inventoryItems,
    mappings,
    orders: state.supplierOrders,
    emailConnection: null
  });
  assert.equal(
    clean.steps.find((step) => step.id === "profile")?.missing.includes(MISSING),
    false
  );
});
