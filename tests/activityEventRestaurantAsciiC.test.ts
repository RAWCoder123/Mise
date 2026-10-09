import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimActivityEventRestaurantToken,
  canonicalizeActivityEventRestaurantId,
  requireCanonicalActivityEventRestaurantId
} from "../services/domain/activityEventRestaurantIdentity";
import { assertTenantScoped, buildShortageResponseSequenceId } from "../services/domain/activityEvents";

const identitySource = readFileSync(
  new URL("../services/domain/activityEventRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const activitySource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005KZ pins activity-event restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005KZ/);
  assert.match(activitySource, /MISE-005KZ/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityEventRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activitySource,
    /requireCanonicalActivityEventRestaurantId\(restaurantId\)/
  );
  assert.doesNotMatch(activitySource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(activitySource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(activitySource, /row\.restaurant_id\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierRecipientRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /hostedUuidIdentity/);
  assert.doesNotMatch(identitySource, /supplierAuthorityIdentity/);
});

test("ASCII trim keeps ordinary activity-event restaurant workspace padding stable", () => {
  assert.equal(asciiTrimActivityEventRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeActivityEventRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalActivityEventRestaurantId(` ${workspace} `), workspace);
  assert.equal(
    buildShortageResponseSequenceId(` ${workspace} `, "item_1"),
    `seq_shortage_${workspace}_item_1`
  );
});

test("ASCII activity-event restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimActivityEventRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeActivityEventRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalActivityEventRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
  assert.throws(
    () => buildShortageResponseSequenceId(nbspPadded, "item_1"),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
  assert.throws(
    () => assertTenantScoped([], nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeActivityEventRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalActivityEventRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
});

test("activity-event restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeActivityEventRestaurantId(""), null);
  assert.equal(canonicalizeActivityEventRestaurantId("   "), null);
  assert.equal(canonicalizeActivityEventRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeActivityEventRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalActivityEventRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalActivityEventRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
  assert.throws(
    () => requireCanonicalActivityEventRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Activity events require a restaurant id."
  );
});
