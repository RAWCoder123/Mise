import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runScheduledRecalculations } from "../services/application/scheduledRecalculations";
import {
  asciiTrimScheduledRecalculationRestaurantToken,
  canonicalizeScheduledRecalculationRestaurantId,
  requireCanonicalScheduledRecalculationRestaurantId
} from "../services/domain/scheduledRecalculationRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/scheduledRecalculationRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/scheduledRecalculations.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LE pins scheduled-recalculation restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LE/);
  assert.match(applicationSource, /MISE-005LE/);

  assert.match(
    identitySource,
    /export function asciiTrimScheduledRecalculationRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /canonicalizeScheduledRecalculationRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);

  // Leave timezone trim and sibling tips alone on this tip.
  assert.match(applicationSource, /input\.restaurantTimeZone\.trim\(\)/);
  assert.doesNotMatch(identitySource, /recalculationRunTransportRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(applicationSource, /recordRecalculationRunRpcArguments/);
  assert.doesNotMatch(applicationSource, /buildRecalculationSchedule/);
});

test("ASCII trim keeps ordinary scheduled-recalculation restaurant workspace padding stable", () => {
  assert.equal(asciiTrimScheduledRecalculationRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(
    requireCanonicalScheduledRecalculationRestaurantId(` ${workspace} `),
    workspace
  );
});

test("ASCII scheduled-recalculation restaurant trim ignores NBSP; Unicode trim would invent identity", async () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimScheduledRecalculationRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  // Dispatch stays fail-soft: never invents, never throws into Home/Today.
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: nbspPadded,
      restaurantTimeZone: "America/New_York"
    }),
    null
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: emSpacePadded,
      restaurantTimeZone: "America/New_York"
    }),
    null
  );
});

test("scheduled-recalculation restaurant workspace rejects empty and control-bearing tokens", async () => {
  assert.equal(canonicalizeScheduledRecalculationRestaurantId(""), null);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId("   "), null);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeScheduledRecalculationRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalScheduledRecalculationRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalScheduledRecalculationRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalScheduledRecalculationRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: "",
      restaurantTimeZone: "America/New_York"
    }),
    null
  );
  assert.equal(
    await runScheduledRecalculations({
      restaurantId: "bad\u0000id",
      restaurantTimeZone: "America/New_York"
    }),
    null
  );
});
