import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createMemory,
  restaurantMemoryFromPersistedRow
} from "../services/domain/restaurantMemory";
import {
  asciiTrimRestaurantMemoryRestaurantToken,
  canonicalizeRestaurantMemoryRestaurantId,
  requireCanonicalRestaurantMemoryRestaurantId,
  requireCanonicalRestaurantMemoryWorkspaceId
} from "../services/domain/restaurantMemoryRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/restaurantMemoryRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const domainSource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/restaurantMemory.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005LB pins restaurant-memory restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LB/);
  assert.match(domainSource, /MISE-005LB/);
  assert.match(applicationSource, /MISE-005LB/);

  assert.match(
    identitySource,
    /export function asciiTrimRestaurantMemoryRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    domainSource,
    /requireCanonicalRestaurantMemoryRestaurantId\(restaurantId\)/
  );
  assert.match(
    applicationSource,
    /requireCanonicalRestaurantMemoryWorkspaceId\(restaurantId\)/
  );
  assert.doesNotMatch(domainSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /input\.restaurantId\.trim\(\)/);
  assert.doesNotMatch(domainSource, /row\.restaurant_id\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /supplierRecipientRestaurantIdentity/);
});

test("ASCII trim keeps ordinary restaurant-memory restaurant workspace padding stable", () => {
  assert.equal(asciiTrimRestaurantMemoryRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalRestaurantMemoryRestaurantId(` ${workspace} `), workspace);
  assert.equal(requireCanonicalRestaurantMemoryWorkspaceId(` ${workspace} `), workspace);

  const memory = createMemory({
    restaurantId: ` ${workspace} `,
    memoryType: "demand_pattern",
    statement: "Friday dinner demand is typically higher.",
    evidence: [
      {
        type: "sales_window",
        id: "fri_4w",
        summary: "Last four Fridays above weekday baseline",
        observedAt: "2026-08-01T12:00:00.000Z"
      }
    ],
    now: "2026-08-02T12:00:00.000Z"
  });
  assert.equal(memory.restaurantId, workspace);

  const hydrated = restaurantMemoryFromPersistedRow({
    id: "memory_1",
    restaurant_id: ` ${workspace} `,
    memory_type: "demand_pattern",
    statement: "Friday dinner demand is typically higher.",
    evidence: [],
    confidence: 0.5,
    first_observed_at: "2026-08-01T12:00:00.000Z",
    last_updated_at: "2026-08-02T12:00:00.000Z",
    scope: "restaurant",
    source: "mise_learning",
    status: "active"
  });
  assert.equal(hydrated.restaurantId, workspace);
});

test("ASCII restaurant-memory restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRestaurantMemoryRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRestaurantMemoryRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryWorkspaceId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () =>
      createMemory({
        restaurantId: nbspPadded,
        memoryType: "demand_pattern",
        statement: "Friday dinner demand is typically higher.",
        evidence: [
          {
            type: "sales_window",
            id: "fri_4w",
            summary: "Last four Fridays above weekday baseline",
            observedAt: "2026-08-01T12:00:00.000Z"
          }
        ]
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
  assert.throws(
    () =>
      restaurantMemoryFromPersistedRow({
        id: "memory_1",
        restaurant_id: nbspPadded,
        memory_type: "demand_pattern",
        statement: "Friday dinner demand is typically higher.",
        evidence: [],
        confidence: 0.5,
        first_observed_at: "2026-08-01T12:00:00.000Z",
        last_updated_at: "2026-08-02T12:00:00.000Z",
        scope: "restaurant",
        source: "mise_learning",
        status: "active"
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRestaurantMemoryRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
});

test("restaurant-memory restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRestaurantMemoryRestaurantId(""), null);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId("   "), null);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRestaurantMemoryRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRestaurantMemoryRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Restaurant memory requires a restaurant id."
  );
  assert.throws(
    () => requireCanonicalRestaurantMemoryWorkspaceId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
