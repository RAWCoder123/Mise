import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationInsightsProfileCuisineType,
  canonicalizePresentationInsightsProfileCuisineType,
  normalizePresentationInsightsProfileCuisineType,
  presentationInsightsProfileCuisineType
} from "../services/domain/presentationInsightsProfileCuisineTypeIdentity";

test("MISE-005UF pins Insights profile cuisine-type labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationInsightsProfileCuisineTypeIdentity.ts",
    "utf8"
  );
  const insightsSource = readFileSync("app/(tabs)/insights.tsx", "utf8");
  const screenTitlesSource = readFileSync("utils/screenTitles.ts", "utf8");
  const brandingSource = readFileSync("utils/restaurantBranding.ts", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationInsightsProfileCuisineType\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    insightsSource,
    /presentationInsightsProfileCuisineType\(cuisineType\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );
  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsProfileCuisineTypeIdentity"/
  );

  // Leave prior Unicode cuisine-type trim removed from Insights profile.
  assert.doesNotMatch(
    insightsSource,
    /cuisineType\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Do not share restaurant-name / Today title / branding initials / Settings
  // email / profile name / team directory / greeting / mailbox modules.
  assert.doesNotMatch(
    insightsSource,
    /presentationInsightsProfileRestaurantNameIdentity|presentationTodayScreenTitleIdentity|presentationRestaurantInitialsIdentity|presentationSettingsAccountEmailLabelIdentity|presentationProfileNameLabelIdentity|presentationTeamDirectoryLabelIdentity|presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|outreachWebhookFromEmailIdentity|userProfileNameIdentity/
  );

  // Leave Insights restaurant-name profile chip on its own tip (#969).
  assert.match(
    insightsSource,
    /restaurantName\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Leave Today screen title and restaurant branding initials on their tips.
  assert.match(screenTitlesSource, /restaurantName\?\.trim\(\)/);
  assert.match(brandingSource, /restaurant\?\.name\?\.trim\(\)/);

  // Leave Settings account email / profile name labels alone.
  assert.match(
    settingsSource,
    /user\?\.email\?\.trim\(\) \|\| t\("settings\.account\.emailMissing"\)/
  );
  assert.match(
    settingsSource,
    /user\?\.name\?\.trim\(\) \|\| t\("settings\.account\.title"\)/
  );

  const cuisineType = "Italian";
  assert.equal(
    asciiTrimPresentationInsightsProfileCuisineType(`  ${cuisineType}  `),
    cuisineType
  );
  assert.equal(
    asciiTrimPresentationInsightsProfileCuisineType(`\tItalian\n`),
    "Italian"
  );
  assert.equal(
    normalizePresentationInsightsProfileCuisineType(`  ${cuisineType}  `),
    cuisineType
  );
  assert.equal(
    canonicalizePresentationInsightsProfileCuisineType(`  ${cuisineType}  `),
    cuisineType
  );
  assert.equal(
    presentationInsightsProfileCuisineType(`  ${cuisineType}  `),
    cuisineType
  );

  // Soft empty / Unicode-only space preserves intentional i18n fallback.
  assert.equal(normalizePresentationInsightsProfileCuisineType(""), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType("   "), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType("\u2003"), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType("\u00a0"), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType(null), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType(undefined), null);
  assert.equal(presentationInsightsProfileCuisineType(null), null);
  assert.equal(presentationInsightsProfileCuisineType("\u2003"), null);
});

test("MISE-005UF refuses Unicode-trim inventing of clean Insights profile cuisine types", () => {
  const paddedCuisine = "\u2003Italian\u2003";
  const nbspCuisine = "\u00a0Italian\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedCuisine.trim(), "Italian");
  assert.equal(nbspCuisine.trim(), "Italian");
  assert.equal(paddedCuisine.trim() || "UNKNOWN", "Italian");
  assert.equal("\u2003".trim() || "UNKNOWN", "UNKNOWN");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationInsightsProfileCuisineType(paddedCuisine), paddedCuisine);
  assert.equal(asciiTrimPresentationInsightsProfileCuisineType(nbspCuisine), nbspCuisine);
  assert.equal(canonicalizePresentationInsightsProfileCuisineType(paddedCuisine), null);
  assert.equal(canonicalizePresentationInsightsProfileCuisineType(nbspCuisine), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType(paddedCuisine), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType(nbspCuisine), null);
  assert.equal(presentationInsightsProfileCuisineType(paddedCuisine), null);
  assert.equal(presentationInsightsProfileCuisineType(nbspCuisine), null);
});

test("MISE-005UF soft-nulls controls and preserves ordinary ASCII-trimmed cuisine types", () => {
  assert.equal(normalizePresentationInsightsProfileCuisineType("Ital\u0001ian"), null);
  assert.equal(normalizePresentationInsightsProfileCuisineType("\u0007Italian"), null);

  assert.equal(presentationInsightsProfileCuisineType("Mexican"), "Mexican");
  assert.equal(presentationInsightsProfileCuisineType("  New American  "), "New American");
  assert.equal(presentationInsightsProfileCuisineType("Japanese"), "Japanese");
});
