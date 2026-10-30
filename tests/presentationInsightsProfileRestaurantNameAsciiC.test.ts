import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asciiTrimPresentationInsightsProfileRestaurantName,
  canonicalizePresentationInsightsProfileRestaurantName,
  normalizePresentationInsightsProfileRestaurantName,
  presentationInsightsProfileRestaurantName
} from "../services/domain/presentationInsightsProfileRestaurantNameIdentity";

test("MISE-005UE pins Insights profile restaurant-name labels to ASCII C", () => {
  const identitySource = readFileSync(
    "services/domain/presentationInsightsProfileRestaurantNameIdentity.ts",
    "utf8"
  );
  const insightsSource = readFileSync("app/(tabs)/insights.tsx", "utf8");
  const screenTitlesSource = readFileSync("utils/screenTitles.ts", "utf8");
  const brandingSource = readFileSync("utils/restaurantBranding.ts", "utf8");
  const settingsSource = readFileSync("app/(tabs)/settings.tsx", "utf8");

  assert.match(
    identitySource,
    /export function asciiTrimPresentationInsightsProfileRestaurantName\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );
  assert.match(
    insightsSource,
    /presentationInsightsProfileRestaurantName\(restaurantName\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );
  assert.match(
    insightsSource,
    /from "\.\.\/\.\.\/services\/domain\/presentationInsightsProfileRestaurantNameIdentity"/
  );

  // Leave prior Unicode restaurant-name trim removed from Insights profile.
  assert.doesNotMatch(
    insightsSource,
    /restaurantName\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
  );

  // Do not share Today title / branding initials / Settings email / profile
  // name / team directory / greeting / mailbox modules.
  assert.doesNotMatch(
    insightsSource,
    /presentationTodayScreenTitleIdentity|presentationRestaurantInitialsIdentity|presentationSettingsAccountEmailLabelIdentity|presentationProfileNameLabelIdentity|presentationTeamDirectoryLabelIdentity|presentationGreetingFirstNameIdentity|outreachGreetingFirstNameIdentity|outreachWebhookFromEmailIdentity|userProfileNameIdentity/
  );

  // Leave Insights cuisine-type profile chip on its own later tip.
  assert.match(
    insightsSource,
    /cuisineType\?\.trim\(\) \|\| t\("insights\.analytics\.profile\.unknown"\)/
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

  const restaurantName = "Luna Bistro";
  assert.equal(
    asciiTrimPresentationInsightsProfileRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(
    asciiTrimPresentationInsightsProfileRestaurantName(`\tLuna Bistro\n`),
    "Luna Bistro"
  );
  assert.equal(
    normalizePresentationInsightsProfileRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(
    canonicalizePresentationInsightsProfileRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );
  assert.equal(
    presentationInsightsProfileRestaurantName(`  ${restaurantName}  `),
    restaurantName
  );

  // Soft empty / Unicode-only space preserves intentional i18n fallback.
  assert.equal(normalizePresentationInsightsProfileRestaurantName(""), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName("   "), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName("\u2003"), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName("\u00a0"), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName(null), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName(undefined), null);
  assert.equal(presentationInsightsProfileRestaurantName(null), null);
  assert.equal(presentationInsightsProfileRestaurantName("\u2003"), null);
});

test("MISE-005UE refuses Unicode-trim inventing of clean Insights profile restaurant names", () => {
  const paddedName = "\u2003Luna Bistro\u2003";
  const nbspName = "\u00a0Luna Bistro\u00a0";

  // Inventing proof on prior Unicode trim path.
  assert.equal(paddedName.trim(), "Luna Bistro");
  assert.equal(nbspName.trim(), "Luna Bistro");
  assert.equal(paddedName.trim() || "UNKNOWN", "Luna Bistro");
  assert.equal("\u2003".trim() || "UNKNOWN", "UNKNOWN");

  // ASCII C prep leaves Unicode end padding alone and soft-nulls.
  assert.equal(asciiTrimPresentationInsightsProfileRestaurantName(paddedName), paddedName);
  assert.equal(asciiTrimPresentationInsightsProfileRestaurantName(nbspName), nbspName);
  assert.equal(canonicalizePresentationInsightsProfileRestaurantName(paddedName), null);
  assert.equal(canonicalizePresentationInsightsProfileRestaurantName(nbspName), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName(paddedName), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName(nbspName), null);
  assert.equal(presentationInsightsProfileRestaurantName(paddedName), null);
  assert.equal(presentationInsightsProfileRestaurantName(nbspName), null);
});

test("MISE-005UE soft-nulls controls and preserves ordinary ASCII-trimmed restaurant names", () => {
  assert.equal(normalizePresentationInsightsProfileRestaurantName("Luna\u0001Bistro"), null);
  assert.equal(normalizePresentationInsightsProfileRestaurantName("\u0007Luna Bistro"), null);

  assert.equal(
    presentationInsightsProfileRestaurantName("Riverside Kitchen"),
    "Riverside Kitchen"
  );
  assert.equal(presentationInsightsProfileRestaurantName("  Harbor Cafe  "), "Harbor Cafe");
  assert.equal(presentationInsightsProfileRestaurantName("Mise Demo"), "Mise Demo");
});
