import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRecalculationSchedule } from "../services/domain/recalculationSchedule";
import {
  asciiTrimRecalculationScheduleRestaurantToken,
  canonicalizeRecalculationScheduleRestaurantId,
  requireCanonicalRecalculationScheduleRestaurantId
} from "../services/domain/recalculationScheduleRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/recalculationScheduleRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const scheduleSource = readFileSync(
  new URL("../services/domain/recalculationSchedule.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const timeZone = "America/New_York";

test("MISE-005LC pins recalculation-schedule restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LC/);
  assert.match(scheduleSource, /MISE-005LC/);

  assert.match(
    identitySource,
    /export function asciiTrimRecalculationScheduleRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    scheduleSource,
    /requireCanonicalRecalculationScheduleRestaurantId\(input\.restaurantId\)/
  );
  assert.doesNotMatch(scheduleSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(scheduleSource, /recalculationRunTransport/);
  assert.doesNotMatch(scheduleSource, /scheduledRecalculations/);
});

test("ASCII trim keeps ordinary recalculation-schedule restaurant workspace padding stable", () => {
  assert.equal(asciiTrimRecalculationScheduleRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalRecalculationScheduleRestaurantId(` ${workspace} `), workspace);

  const schedule = buildRecalculationSchedule({
    restaurantId: ` ${workspace} `,
    restaurantTimeZone: timeZone,
    runs: [],
    now: new Date("2026-08-05T09:30:00.000Z")
  });
  assert.equal(schedule.restaurantId, workspace);
  assert.ok(
    schedule.decisions.every((decision) =>
      decision.idempotencyKey.startsWith(`recalc:${workspace}:`)
    )
  );
});

test("ASCII recalculation-schedule restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRecalculationScheduleRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
  assert.throws(
    () =>
      buildRecalculationSchedule({
        restaurantId: nbspPadded,
        restaurantTimeZone: timeZone,
        runs: []
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
  assert.throws(
    () =>
      buildRecalculationSchedule({
        restaurantId: emSpacePadded,
        restaurantTimeZone: timeZone,
        runs: []
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
});

test("recalculation-schedule restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRecalculationScheduleRestaurantId(""), null);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId("   "), null);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRecalculationScheduleRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRecalculationScheduleRestaurantId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalRecalculationScheduleRestaurantId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalRecalculationScheduleRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation scheduling requires a restaurant."
  );
});
