import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRecalculationSchedule } from "../services/domain/recalculationSchedule";
import {
  asciiTrimRecalculationScheduleTimeZoneToken,
  canonicalizeRecalculationScheduleTimeZone,
  requireCanonicalRecalculationScheduleTimeZone
} from "../services/domain/recalculationScheduleTimeZoneIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/recalculationScheduleTimeZoneIdentity.ts", import.meta.url),
  "utf8"
);
const scheduleSource = readFileSync(
  new URL("../services/domain/recalculationSchedule.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const timeZone = "America/New_York";

test("MISE-005NF pins recalculation-schedule restaurantTimeZone to ASCII C", () => {
  assert.match(identitySource, /MISE-005NF/);
  assert.match(scheduleSource, /MISE-005NF/);

  assert.match(
    identitySource,
    /export function asciiTrimRecalculationScheduleTimeZoneToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scheduleSource,
    /requireCanonicalRecalculationScheduleTimeZone\(input\.restaurantTimeZone\)/
  );
  assert.doesNotMatch(scheduleSource, /input\.restaurantTimeZone\.trim\(\)/);

  // Leave sibling restaurant-workspace tip #733 alone.
  assert.doesNotMatch(identitySource, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /requireCanonicalRecalculationScheduleRestaurantId/);
  assert.doesNotMatch(
    identitySource,
    /Recalculation scheduling requires a restaurant\./
  );
  assert.doesNotMatch(scheduleSource, /recalculationScheduleRestaurantIdentity/);

  // Leave application scheduled-recalculation tip #735 alone.
  assert.doesNotMatch(identitySource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(scheduleSource, /scheduledRecalculationRestaurantIdentity/);
  assert.doesNotMatch(
    scheduleSource,
    /from ["'].*scheduledRecalculations["']/
  );

  // Do not rewrite wasteAnalysis / supplierReliability timezone emptiness.
  assert.doesNotMatch(identitySource, /wasteAnalysisRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierReliabilityRestaurantIdentity/);
});

test("ASCII trim keeps ordinary recalculation-schedule timezone padding stable", () => {
  assert.equal(asciiTrimRecalculationScheduleTimeZoneToken(`  ${timeZone}  `), timeZone);
  assert.equal(canonicalizeRecalculationScheduleTimeZone(`\t${timeZone}\n`), timeZone);
  assert.equal(requireCanonicalRecalculationScheduleTimeZone(` ${timeZone} `), timeZone);

  const schedule = buildRecalculationSchedule({
    restaurantId: workspace,
    restaurantTimeZone: ` ${timeZone} `,
    runs: [],
    now: new Date("2026-08-05T09:30:00.000Z")
  });
  assert.equal(schedule.restaurantTimeZone, timeZone);
  assert.equal(schedule.operatingDate, "2026-08-05");
});

test("ASCII recalculation-schedule timezone trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${timeZone}\u00a0`;
  // Unicode trim invents an exact match against the unpadded IANA timezone.
  assert.equal(nbspPadded.trim(), timeZone);
  assert.notEqual(asciiTrimRecalculationScheduleTimeZoneToken(nbspPadded), timeZone);
  assert.equal(canonicalizeRecalculationScheduleTimeZone(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleTimeZone(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
  assert.throws(
    () =>
      buildRecalculationSchedule({
        restaurantId: workspace,
        restaurantTimeZone: nbspPadded,
        runs: []
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );

  // Prove inventing: Unicode-trimmed padded TZ yields the same service day as
  // the unpadded restaurant timezone on main's emptiness-then-trim path.
  const invented = nbspPadded.trim();
  const inventedSchedule = buildRecalculationSchedule({
    restaurantId: workspace,
    restaurantTimeZone: invented,
    runs: [],
    now: new Date("2026-08-05T09:30:00.000Z")
  });
  const canonicalSchedule = buildRecalculationSchedule({
    restaurantId: workspace,
    restaurantTimeZone: timeZone,
    runs: [],
    now: new Date("2026-08-05T09:30:00.000Z")
  });
  assert.equal(inventedSchedule.operatingDate, canonicalSchedule.operatingDate);
  assert.equal(inventedSchedule.restaurantTimeZone, canonicalSchedule.restaurantTimeZone);

  const emSpacePadded = `\u2003${timeZone}\u2003`;
  assert.equal(emSpacePadded.trim(), timeZone);
  assert.equal(canonicalizeRecalculationScheduleTimeZone(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleTimeZone(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
  assert.throws(
    () =>
      buildRecalculationSchedule({
        restaurantId: workspace,
        restaurantTimeZone: emSpacePadded,
        runs: []
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
});

test("recalculation-schedule timezone rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRecalculationScheduleTimeZone(""), null);
  assert.equal(canonicalizeRecalculationScheduleTimeZone("   "), null);
  assert.equal(canonicalizeRecalculationScheduleTimeZone("a".repeat(129)), null);
  assert.equal(canonicalizeRecalculationScheduleTimeZone("bad\u0000zone"), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleTimeZone(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
  assert.throws(
    () => requireCanonicalRecalculationScheduleTimeZone(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
  assert.throws(
    () => requireCanonicalRecalculationScheduleTimeZone("bad\u0000zone"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant timezone."
  );
});
