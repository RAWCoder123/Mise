import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { autonomyRuleFromPersistedRow } from "../services/domain/restaurantAutonomy";
import {
  asciiTrimRestaurantAutonomyRestaurantToken,
  canonicalizeRestaurantAutonomyRestaurantId,
  requireCanonicalRestaurantAutonomyRestaurantId
} from "../services/domain/restaurantAutonomyRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantAutonomyRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantAutonomy.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005SG pins restaurant-autonomy restaurant_id hydrate to ASCII C", () => {
  assert.match(identitySource, /MISE-005SG/);
  assert.match(domainSource, /MISE-005SG/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantAutonomyRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalRestaurantAutonomyRestaurantId\(restaurantId\)/
  );
  assert.doesNotMatch(domainSource, /row\.restaurant_id\.trim\(\)/);
  assert.doesNotMatch(domainSource, /restaurant_id\.trim\(\)/);

  // Leave sibling tips alone (module imports / shared helpers).
  assert.doesNotMatch(identitySource, /from ["'].*autonomyRestaurantIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["'].*restaurantMemoryRestaurantIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["'].*miseActionsRestaurantIdentity["']/);
  assert.doesNotMatch(identitySource, /from ["'].*wasteAnalysisRestaurantIdentity["']/);
  assert.doesNotMatch(identitySource, /spendLimitCents|allowedStartTime|communication_type/);
});

test("ASCII trim keeps ordinary restaurant-autonomy restaurant workspace padding stable", () => {
  assert.equal(asciiTrimRestaurantAutonomyRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalRestaurantAutonomyRestaurantId(` ${workspace} `), workspace);

  const hydrated = autonomyRuleFromPersistedRow({
    id: "autonomy_1",
    restaurant_id: ` ${workspace} `,
    location_id: null,
    action_type: "prepare_supplier_order_draft",
    operational_category: "orders",
    maximum_autonomy_level: 3,
    requires_approval: true,
    enabled: true,
    spend_limit_cents: 50000,
    supplier_id: null,
    supplier_name: null,
    communication_type: null,
    allowed_start_time: null,
    allowed_end_time: null,
    created_at: "2026-08-02T12:00:00.000Z",
    updated_at: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(hydrated.restaurantId, workspace);
});

test("ASCII restaurant-autonomy restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRestaurantAutonomyRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRestaurantAutonomyRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
  assert.throws(
    () =>
      autonomyRuleFromPersistedRow({
        id: "autonomy_1",
        restaurant_id: nbspPadded,
        location_id: null,
        action_type: "prepare_supplier_order_draft",
        operational_category: "orders",
        maximum_autonomy_level: 3,
        requires_approval: true,
        enabled: true,
        spend_limit_cents: 50000,
        supplier_id: null,
        supplier_name: null,
        communication_type: null,
        allowed_start_time: null,
        allowed_end_time: null,
        created_at: "2026-08-02T12:00:00.000Z",
        updated_at: "2026-08-02T12:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRestaurantAutonomyRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
  assert.throws(
    () =>
      autonomyRuleFromPersistedRow({
        id: "autonomy_1",
        restaurant_id: emSpacePadded,
        location_id: null,
        action_type: "send_supplier_order",
        operational_category: "orders",
        maximum_autonomy_level: 3,
        requires_approval: true,
        enabled: false,
        spend_limit_cents: 25000,
        supplier_id: null,
        supplier_name: null,
        communication_type: "email",
        allowed_start_time: null,
        allowed_end_time: null,
        created_at: "2026-08-02T12:00:00.000Z",
        updated_at: "2026-08-02T12:00:00.000Z"
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
});

test("restaurant-autonomy restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId(""), null);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId("   "), null);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId("\u2003"), null);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRestaurantAutonomyRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRestaurantAutonomyRestaurantId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantAutonomyRestaurantId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantAutonomyRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Restaurant autonomy requires a restaurant id."
  );
});
