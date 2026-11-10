import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSetupReadySubtitleRestaurantName,
  canonicalizeSetupReadySubtitleRestaurantName,
  normalizeSetupReadySubtitleRestaurantName
} from "../services/domain/presentationSetupReadySubtitleRestaurantNameIdentity";

const identitySource = readFileSync(
  new URL(
    "../services/domain/presentationSetupReadySubtitleRestaurantNameIdentity.ts",
    import.meta.url
  ),
  "utf8"
);
const setupSource = readFileSync(new URL("../app/(auth)/setup.tsx", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../i18n/catalog.ts", import.meta.url), "utf8");
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const restaurantNameIdentityPath = new URL(
  "../services/domain/restaurantNameIdentity.ts",
  import.meta.url
);
const homeGreetingIdentityPath = new URL(
  "../services/domain/presentationHomeGreetingRestaurantNameIdentity.ts",
  import.meta.url
);
const askGreetingIdentityPath = new URL(
  "../services/domain/presentationAskMiseGreetingRestaurantNameIdentity.ts",
  import.meta.url
);

const restaurantName = "Luna Bistro";
const accentedName = "Café Luna";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

test("MISE-005ABK pins setup.ready.subtitle readyName to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABK/);
  assert.match(setupSource, /MISE-005ABK/);

  assert.match(
    identitySource,
    /export function asciiTrimSetupReadySubtitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.ok(identitySource.includes("/[\\u0000-\\u001f\\u007f]/"));
  // Single-line restaurant-name tips preserve NBSP — do not fold into plain space.
  assert.ok(!identitySource.includes('.replace(/\\u00a0/g, " ")'));
  const trimFn = identitySource.slice(
    identitySource.indexOf("export function asciiTrimSetupReadySubtitleRestaurantName("),
    identitySource.indexOf("function hasControlCharacters(")
  );
  assert.doesNotMatch(trimFn, /\.trim\(\)/);
  assert.doesNotMatch(trimFn, /\\s/);
  assert.doesNotMatch(trimFn, /\.toLowerCase\(\)/);

  assert.match(
    setupSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationSetupReadySubtitleRestaurantNameIdentity"/
  );
  assert.match(setupSource, /normalizeSetupReadySubtitleRestaurantName\(/);
  assert.match(
    setupSource,
    /const setupReadyRestaurantName = normalizeSetupReadySubtitleRestaurantName\(\s*readyName\s*\)/
  );
  assert.match(
    setupSource,
    /setupReadyRestaurantName\s*\?\s*t\("setup\.ready\.subtitle", \{\s*restaurant: setupReadyRestaurantName\s*\}\)\s*:\s*t\("setup\.ready\.subtitle\.none"\)/
  );
  assert.doesNotMatch(
    setupSource,
    /t\("setup\.ready\.subtitle", \{\s*restaurant: readyName\s*\}\)/
  );

  // Inventing / bypass substrate: emptiness gates Unicode-trim, while
  // setReadyName still stores the raw form for the always-pass subtitle.
  assert.match(setupSource, /setReadyName\(restaurantName\)/);
  assert.match(setupSource, /if \(!restaurantName\.trim\(\) \|\| !cuisineType\.trim\(\)\)/);
  assert.match(
    setupSource,
    /if \(!restaurantName\.trim\(\) \|\| !cuisineType\.trim\(\)\) \{\s*return setupValidationFailure\("profile"/
  );

  assert.match(
    catalogSource,
    /"setup\.ready\.subtitle\.none": "Mise is ready to start learning\."/
  );
  assert.match(
    catalogSource,
    /"setup\.ready\.subtitle\.none": "Mise está listo para empezar a aprender\."/
  );
  assert.match(catalogSource, /"setup\.ready\.subtitle\.none": "Mise 已准备开始学习。"/);

  // Leave durable restaurant-name write canonicalize alone (#844 / MISE-005PJ).
  assert.doesNotMatch(setupSource, /restaurantNameIdentity/);
  assert.doesNotMatch(setupSource, /normalizeCanonicalRestaurantName/);
  assert.doesNotMatch(setupSource, /canonicalizeRestaurantName/);
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /restaurantNameIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(restaurantNameIdentityPath), "absent");
  // Leave Home / Ask Mise greeting restaurant-name tips alone (open sibling tips).
  assert.doesNotMatch(identityCode, /presentationHomeGreetingRestaurantNameIdentity/);
  assert.doesNotMatch(identityCode, /presentationAskMiseGreetingRestaurantNameIdentity/);
  assert.equal(filePresence(homeGreetingIdentityPath), "absent");
  assert.equal(filePresence(askGreetingIdentityPath), "absent");
  // miseValidation write path remains untouched on this tip.
  assert.doesNotMatch(validationSource, /presentationSetupReadySubtitleRestaurantNameIdentity/);
});

test("ASCII C prep keeps ordinary setup.ready.subtitle restaurant names stable", () => {
  assert.equal(asciiTrimSetupReadySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(asciiTrimSetupReadySubtitleRestaurantName(`\t${restaurantName}\n`), restaurantName);
  assert.equal(canonicalizeSetupReadySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(`  ${restaurantName}  `), restaurantName);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(accentedName), accentedName);
  assert.equal(normalizeSetupReadySubtitleRestaurantName("月见餐厅"), "月见餐厅");
  assert.equal(normalizeSetupReadySubtitleRestaurantName("Luna_01"), "Luna_01");
});

test("Unicode-only space cannot bypass setup.ready.subtitle.none fallback", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Bypass proof: truthy Unicode-only-space readyName previously still
  // chose setup.ready.subtitle and interpolated blank-looking identity.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.equal(Boolean(empty), false);
  assert.equal(unicodeOnly.length >= 1, true);
  assert.notEqual(unicodeOnly.trim(), unicodeOnly);
  assert.equal(unicodeOnly.trim(), "");

  // Soft-null restores the intentional localized subtitle.none path.
  assert.equal(normalizeSetupReadySubtitleRestaurantName(unicodeOnly), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(nbspOnly), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(empty), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName("   "), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(unicodeOnly) || "FALLBACK", "FALLBACK");
});

test("Unicode em-space / NBSP padding cannot invent clean setup.ready.subtitle restaurant names", () => {
  const padded = `${em}${restaurantName}${em}`;
  const nbspName = `${nbsp}${restaurantName}${nbsp}`;
  const internalEm = `Luna${em}Bistro`;
  const internalNbsp = `Luna${nbsp}Bistro`;

  // Inventing proof: Unicode trim would invent the clean restaurant name,
  // and setup emptiness gates accept that padded form as non-empty.
  assert.equal(padded.trim(), restaurantName);
  assert.equal(nbspName.trim(), restaurantName);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);
  assert.equal(Boolean(padded.trim()), true);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimSetupReadySubtitleRestaurantName(padded), padded);
  assert.equal(canonicalizeSetupReadySubtitleRestaurantName(padded), null);
  assert.equal(canonicalizeSetupReadySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(padded), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(nbspName), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(padded) || "FALLBACK", "FALLBACK");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeSetupReadySubtitleRestaurantName(internalEm), internalEm);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(internalNbsp), internalNbsp);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for setup.ready.subtitle restaurant names", () => {
  assert.equal(normalizeSetupReadySubtitleRestaurantName(undefined), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(null), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(""), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName("   "), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(123 as unknown as string), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(`\u0001${restaurantName}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeSetupReadySubtitleRestaurantName(`${restaurantName}\t`), restaurantName);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(`${restaurantName}\u0007`), null);
  assert.equal(normalizeSetupReadySubtitleRestaurantName(em), null);
});
