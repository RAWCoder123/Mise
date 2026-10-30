import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationTodayScreenTitleRestaurantName,
  canonicalizePresentationTodayScreenTitleRestaurantName,
  normalizePresentationTodayScreenTitleRestaurantName
} from "../services/domain/presentationTodayScreenTitleIdentity";
import { todayScreenTitle } from "../utils/screenTitles";

test("MISE-005UD pins Today screen title restaurant name to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationTodayScreenTitleIdentity.ts",
    "utf8"
  );
  const screenTitlesSource = readFileSync("utils/screenTitles.ts", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationTodayScreenTitleRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    screenTitlesSource,
    /normalizePresentationTodayScreenTitleRestaurantName\(restaurantName\)/
  );
  assert.match(
    screenTitlesSource,
    /from "\.\.\/services\/domain\/presentationTodayScreenTitleIdentity"/
  );

  // Leave prior Unicode restaurant-name trim path removed from screenTitles.
  assert.doesNotMatch(screenTitlesSource, /restaurantName\?\.trim\(\)/);

  // Do not share branding / greeting / directory / profile modules.
  assert.doesNotMatch(
    screenTitlesSource,
    /presentationRestaurantInitialsIdentity|presentationGreetingFirstNameIdentity|presentationProfileInitialsIdentity|presentationProfileNameLabelIdentity|presentationSettingsAccountEmailLabelIdentity|presentationTeamDirectoryLabelIdentity/
  );
  assert.doesNotMatch(
    identitySource,
    /from ["'].*presentationRestaurantInitialsIdentity|from ["'].*presentationGreetingFirstNameIdentity|from ["'].*presentationProfileInitialsIdentity/
  );

  const restaurantName = "Luna Bistro";
  assert.equal(
    asciiTrimPresentationTodayScreenTitleRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(
    asciiTrimPresentationTodayScreenTitleRestaurantName(`\tLuna\n`),
    "Luna"
  );
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName("  Chef  "),
    "Chef"
  );
  assert.equal(
    canonicalizePresentationTodayScreenTitleRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(todayScreenTitle(`  ${restaurantName}  `), "Today at Luna Bistro");
  assert.equal(todayScreenTitle("  Chef  "), "Today at Chef");
  assert.equal(todayScreenTitle("Jordan"), "Today at Jordan");
  assert.equal(
    todayScreenTitle("Maria Elena Lopez"),
    "Today at Maria Elena Lopez"
  );
  assert.equal(todayScreenTitle(null), "Today at Mise");
  assert.equal(todayScreenTitle(undefined), "Today at Mise");

  // Soft empty / Unicode-only space preserves intentional "Today at Mise" fallback.
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName(""), null);
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName("   "), null);
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName("\u2003"), null);
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName("\u00a0"), null);
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName(null), null);
  assert.equal(normalizePresentationTodayScreenTitleRestaurantName(undefined), null);
  assert.equal(todayScreenTitle(""), "Today at Mise");
  assert.equal(todayScreenTitle("\u2003"), "Today at Mise");
  assert.equal(todayScreenTitle("  "), "Today at Mise");
});

test("MISE-005UD refuses Unicode-trim inventing of clean Today title restaurant names", () => {
  const paddedName = "\u2003Luna Bistro\u2003";
  const nbspName = "\u00a0Luna Bistro\u00a0";

  // Inventing proof on prior Unicode trim path.
  const paddedTrimmed = paddedName.trim();
  assert.equal(paddedTrimmed, "Luna Bistro");
  assert.equal(
    paddedTrimmed ? `Today at ${paddedTrimmed}` : "Today at Mise",
    "Today at Luna Bistro"
  );
  assert.equal(nbspName.trim(), "Luna Bistro");
  assert.equal(
    nbspName.trim() ? `Today at ${nbspName.trim()}` : "Today at Mise",
    "Today at Luna Bistro"
  );

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(
    asciiTrimPresentationTodayScreenTitleRestaurantName(paddedName),
    paddedName
  );
  assert.equal(
    asciiTrimPresentationTodayScreenTitleRestaurantName(nbspName),
    nbspName
  );
  assert.equal(
    canonicalizePresentationTodayScreenTitleRestaurantName(paddedName),
    null
  );
  assert.equal(
    canonicalizePresentationTodayScreenTitleRestaurantName(nbspName),
    null
  );
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName(paddedName),
    null
  );
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName(nbspName),
    null
  );
  assert.equal(todayScreenTitle(paddedName), "Today at Mise");
  assert.equal(todayScreenTitle(nbspName), "Today at Mise");
});

test("MISE-005UD soft-nulls controls and preserves full restaurant-name titles", () => {
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName("Luna\u0001Bistro"),
    null
  );
  assert.equal(
    normalizePresentationTodayScreenTitleRestaurantName("\u0007Chef"),
    null
  );
  assert.equal(todayScreenTitle("Luna\u0001Bistro"), "Today at Mise");
  assert.equal(todayScreenTitle("\u0007Chef"), "Today at Mise");

  assert.equal(
    todayScreenTitle("  Jordan  Lee  "),
    "Today at Jordan  Lee"
  );
  assert.equal(todayScreenTitle("Mise"), "Today at Mise");

  // Leave restaurant branding initials Unicode path ownership to #967.
  const brandingSource = readFileSync("utils/restaurantBranding.ts", "utf8");
  assert.doesNotMatch(
    brandingSource,
    /presentationTodayScreenTitleIdentity|normalizePresentationTodayScreenTitleRestaurantName/
  );
});
