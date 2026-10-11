import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runScheduledRecalculations } from "../services/application/scheduledRecalculations";
import {
  asciiTrimScheduledRecalculationTimeZoneToken,
  canonicalizeScheduledRecalculationTimeZone,
  requireCanonicalScheduledRecalculationTimeZone
} from "../services/domain/scheduledRecalculationTimeZoneIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/scheduledRecalculationTimeZoneIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/scheduledRecalculations.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const timeZone = "America/New_York";

test("MISE-005NG pins scheduled-recalculation restaurantTimeZone to ASCII C", () => {
  assert.match(identitySource, /MISE-005NG/);
  assert.match(applicationSource, /MISE-005NG/);

  assert.match(
    identitySource,
    /export function asciiTrimScheduledRecalculationTimeZoneToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /canonicalizeScheduledRecalculationTimeZone\(\s*input\.restaurantTimeZone\s*\)/
  );
  assert.doesNotMatch(applicationSource, /input\.restaurantTimeZone\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantTimeZone\.trim\(\)/);

  // Leave restaurant-workspace tip #735 alone on this tip.
  assert.match(applicationSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /canonicalizeScheduledRecalculationRestaurantId/);
  assert.doesNotMatch(identitySource, /Missing restaurant workspace\./);
  assert.doesNotMatch(applicationSource, /scheduledRecalculationRestaurantIdentity/);

  // Leave domain recalculation-schedule timezone tip #788 alone.
  assert.doesNotMatch(identitySource, /recalculationScheduleTimeZoneIdentity/);
  assert.doesNotMatch(identitySource, /requireCanonicalRecalculationScheduleTimeZone/);
  assert.doesNotMatch(
    identitySource,
    /Recalculation scheduling requires a restaurant timezone\./
  );
  assert.doesNotMatch(applicationSource, /recalculationScheduleTimeZoneIdentity/);
  assert.doesNotMatch(applicationSource, /buildRecalculationSchedule/);

  // Do not rewrite wasteAnalysis / supplierReliability / dailyCloseout timezone emptiness.
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /dailyCloseout/);
});

test("ASCII trim keeps ordinary scheduled-recalculation timezone padding stable", () => {
  assert.equal(asciiTrimScheduledRecalculationTimeZoneToken(`  ${timeZone}  `), timeZone);
  assert.equal(canonicalizeScheduledRecalculationTimeZone(`\t${timeZone}\n`), timeZone);
  assert.equal(requireCanonicalScheduledRecalculationTimeZone(` ${timeZone} `), timeZone);
});

test("ASCII scheduled-recalculation timezone trim ignores NBSP; Unicode trim would invent identity", async () => {
  const nbspPadded = `\u00a0${timeZone}\u00a0`;
  // Unicode trim invents an exact match against the unpadded IANA timezone.
  assert.equal(nbspPadded.trim(), timeZone);
  assert.notEqual(asciiTrimScheduledRecalculationTimeZoneToken(nbspPadded), timeZone);
  assert.equal(canonicalizeScheduledRecalculationTimeZone(nbspPadded), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationTimeZone(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant timezone."
  );
  // Dispatch stays fail-soft: never invents, never throws into Home/Today.
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: workspace,
      restaurantTimeZone: nbspPadded
    }),
    null
  );

  // Prove inventing: Unicode-trimmed padded TZ would have passed the previous
  // emptiness check and entered cycle dispatch as the unpadded restaurant TZ.
  const invented = nbspPadded.trim();
  assert.equal(invented, timeZone);
  assert.equal(canonicalizeScheduledRecalculationTimeZone(invented), timeZone);

  const emSpacePadded = `\u2003${timeZone}\u2003`;
  assert.equal(emSpacePadded.trim(), timeZone);
  assert.equal(canonicalizeScheduledRecalculationTimeZone(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationTimeZone(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant timezone."
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: workspace,
      restaurantTimeZone: emSpacePadded
    }),
    null
  );
});

test("scheduled-recalculation timezone rejects empty and control-bearing tokens", async () => {
  assert.equal(canonicalizeScheduledRecalculationTimeZone(""), null);
  assert.equal(canonicalizeScheduledRecalculationTimeZone("   "), null);
  assert.equal(canonicalizeScheduledRecalculationTimeZone("a".repeat(129)), null);
  assert.equal(canonicalizeScheduledRecalculationTimeZone("bad\u0000zone"), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationTimeZone(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant timezone."
  );
  assert.throws(
    () => requireCanonicalScheduledRecalculationTimeZone(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant timezone."
  );
  assert.throws(
    () => requireCanonicalScheduledRecalculationTimeZone("bad\u0000zone"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant timezone."
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: workspace,
      restaurantTimeZone: ""
    }),
    null
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: workspace,
      restaurantTimeZone: "bad\u0000zone"
    }),
    null
  );
});
