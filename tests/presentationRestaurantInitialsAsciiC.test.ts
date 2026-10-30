import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationRestaurantInitialsSeed,
  canonicalizePresentationRestaurantInitialsSeed,
  normalizePresentationRestaurantInitialsSeed,
  presentationRestaurantInitialsFromSeed
} from "../services/domain/presentationRestaurantInitialsIdentity";
import { restaurantInitials } from "../utils/restaurantBranding";

test("MISE-005UC pins restaurant branding initials to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationRestaurantInitialsIdentity.ts",
    "utf8"
  );
  const brandingSource = readFileSync("utils/restaurantBranding.ts", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationRestaurantInitialsSeed\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    brandingSource,
    /presentationRestaurantInitialsFromSeed\(restaurant\?\.name\)/
  );
  assert.match(
    brandingSource,
    /from "\.\.\/services\/domain\/presentationRestaurantInitialsIdentity"/
  );

  // Leave prior Unicode initials trim path removed from restaurant branding.
  assert.doesNotMatch(brandingSource, /restaurant\?\.name\?\.trim\(\)/);
  assert.doesNotMatch(brandingSource, /name\.split\(\\s\+\)\.slice\(0, 2\)/);

  // Do not share profile / greeting / directory / screen-title modules.
  assert.doesNotMatch(
    brandingSource,
    /presentationProfileInitialsIdentity|presentationGreetingFirstNameIdentity|presentationProfileNameLabelIdentity|presentationSettingsAccountEmailLabelIdentity|presentationTeamDirectoryLabelIdentity|screenTitles/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationProfileInitialsIdentity|from ["'].*presentationGreetingFirstNameIdentity|from ["'].*screenTitles/
  );

  const restaurantName = "Luna Bistro";
  assert.equal(
    asciiTrimPresentationRestaurantInitialsSeed(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(asciiTrimPresentationRestaurantInitialsSeed(`\tLuna\n`), "Luna");
  assert.equal(
    normalizePresentationRestaurantInitialsSeed(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(normalizePresentationRestaurantInitialsSeed("  Chef  "), "Chef");
  assert.equal(
    canonicalizePresentationRestaurantInitialsSeed(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(presentationRestaurantInitialsFromSeed(`  ${restaurantName}  `), "LB");
  assert.equal(presentationRestaurantInitialsFromSeed("  Chef  "), "C");
  assert.equal(presentationRestaurantInitialsFromSeed("Jordan"), "J");
  assert.equal(presentationRestaurantInitialsFromSeed("Maria Elena Lopez"), "ME");
  assert.equal(restaurantInitials({ name: `  ${restaurantName}  ` } as never), "LB");
  assert.equal(restaurantInitials({ name: "Chef" } as never), "C");
  assert.equal(restaurantInitials({ name: null } as never), "M");
  assert.equal(restaurantInitials(null), "M");
  assert.equal(restaurantInitials(undefined), "M");

  // Soft empty / Unicode-only space preserves intentional "M" fallback.
  assert.equal(normalizePresentationRestaurantInitialsSeed(""), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed("   "), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed("\u2003"), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed("\u00a0"), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed(null), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed(undefined), null);
  assert.equal(presentationRestaurantInitialsFromSeed(""), "M");
  assert.equal(presentationRestaurantInitialsFromSeed("\u2003"), "M");
  assert.equal(presentationRestaurantInitialsFromSeed(null), "M");
  assert.equal(restaurantInitials({ name: "\u2003" } as never), "M");
});

test("MISE-005UC refuses Unicode-trim inventing of clean restaurant branding initials", () => {
  const paddedName = "\u2003Luna Bistro\u2003";
  const nbspName = "\u00a0Luna Bistro\u00a0";

  // Inventing proof on prior Unicode trim path.
  const paddedParts = paddedName.trim().split(/\s+/).slice(0, 2);
  assert.deepEqual(paddedParts, ["Luna", "Bistro"]);
  assert.equal(
    paddedParts.map((part) => part[0]?.toUpperCase() ?? "").join(""),
    "LB"
  );
  assert.deepEqual(nbspName.trim().split(/\s+/).slice(0, 2), ["Luna", "Bistro"]);

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationRestaurantInitialsSeed(paddedName), paddedName);
  assert.equal(asciiTrimPresentationRestaurantInitialsSeed(nbspName), nbspName);
  assert.equal(canonicalizePresentationRestaurantInitialsSeed(paddedName), null);
  assert.equal(canonicalizePresentationRestaurantInitialsSeed(nbspName), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed(paddedName), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed(nbspName), null);
  assert.equal(presentationRestaurantInitialsFromSeed(paddedName), "M");
  assert.equal(presentationRestaurantInitialsFromSeed(nbspName), "M");
  assert.equal(restaurantInitials({ name: paddedName } as never), "M");
  assert.equal(restaurantInitials({ name: nbspName } as never), "M");
});

test("MISE-005UC soft-nulls controls and preserves restaurant token selection", () => {
  assert.equal(normalizePresentationRestaurantInitialsSeed("Luna\u0001Bistro"), null);
  assert.equal(normalizePresentationRestaurantInitialsSeed("\u0007Chef"), null);
  assert.equal(presentationRestaurantInitialsFromSeed("Luna\u0001Bistro"), "M");
  assert.equal(restaurantInitials({ name: "Luna\u0001Bistro" } as never), "M");

  assert.equal(presentationRestaurantInitialsFromSeed("  Jordan  Lee  "), "JL");
  assert.equal(presentationRestaurantInitialsFromSeed("Mise"), "M");
  // Leave screenTitles Today title restaurant-name `.trim()` alone.
  const screenTitlesSource = readFileSync("utils/screenTitles.ts", "utf8");
  assert.match(screenTitlesSource, /restaurantName\?\.trim\(\)/);
});
