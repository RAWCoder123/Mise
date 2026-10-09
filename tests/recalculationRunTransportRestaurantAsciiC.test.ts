import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  recordRecalculationRunRpcArguments,
  recalculationRunFromPersistedRow
} from "../services/domain/recalculationRunTransport";
import {
  asciiTrimRecalculationRunTransportRestaurantToken,
  canonicalizeRecalculationRunTransportRestaurantId,
  requireCanonicalRecalculationRunTransportRestaurantId
} from "../services/domain/recalculationRunTransportRestaurantIdentity";
import type { RecalculationRunInput } from "../services/repositories/repositoryContracts";

const identitySource = readFileSync(
  new URL("../services/domain/recalculationRunTransportRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const transportSource = readFileSync(
  new URL("../services/domain/recalculationRunTransport.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

function sampleRunInput(restaurantId: string): RecalculationRunInput {
  return {
    restaurantId,
    cycle: "daily_open",
    operatingDate: "2026-08-05",
    status: "succeeded",
    attempt: 1,
    jobName: "regenerate_operational_signals",
    monitoringOwner: "manager",
    startedAt: "2026-08-05T12:00:00.000Z",
    completedAt: "2026-08-05T12:00:01.000Z",
    durationMs: 1000,
    timedOut: false,
    failureReason: null,
    cycleKey: `recalc:${workspace}:2026-08-05:daily_open`,
    idempotencyKey: `recalc:${workspace}:2026-08-05:daily_open:attempt-1`
  };
}

test("MISE-005LD pins recalculation-run transport restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005LD/);
  assert.match(transportSource, /MISE-005LD/);

  assert.match(
    identitySource,
    /export function asciiTrimRecalculationRunTransportRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    transportSource,
    /requireCanonicalRecalculationRunTransportRestaurantId\(\s*input\.restaurantId\s*\)/
  );
  assert.doesNotMatch(transportSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /floorNoteRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /activityEventRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /purchaseLineRestaurantIdentity/);
  assert.doesNotMatch(transportSource, /scheduledRecalculations/);
  assert.doesNotMatch(transportSource, /buildRecalculationSchedule/);
  assert.doesNotMatch(transportSource, /runScheduledRecalculations/);
});

test("ASCII trim keeps ordinary recalculation-run transport restaurant workspace padding stable", () => {
  assert.equal(asciiTrimRecalculationRunTransportRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(
    requireCanonicalRecalculationRunTransportRestaurantId(` ${workspace} `),
    workspace
  );

  const args = recordRecalculationRunRpcArguments(sampleRunInput(` ${workspace} `));
  assert.equal(args.p_restaurant_id, workspace);
  assert.equal(args.p_cycle, "daily_open");
  assert.equal(args.p_operating_date, "2026-08-05");
});

test("ASCII recalculation-run transport restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimRecalculationRunTransportRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalRecalculationRunTransportRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
  assert.throws(
    () => recordRecalculationRunRpcArguments(sampleRunInput(nbspPadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalRecalculationRunTransportRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
  assert.throws(
    () => recordRecalculationRunRpcArguments(sampleRunInput(emSpacePadded)),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
});

test("recalculation-run transport restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId(""), null);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId("   "), null);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeRecalculationRunTransportRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalRecalculationRunTransportRestaurantId(null),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalRecalculationRunTransportRestaurantId(""),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
  assert.throws(
    () => requireCanonicalRecalculationRunTransportRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
  assert.throws(
    () => recordRecalculationRunRpcArguments(sampleRunInput("")),
    (error: unknown) =>
      error instanceof Error &&
      error.message === "Recalculation run recording requires a restaurant."
  );
});

test("recalculation-run transport row reader leaves restaurant_id untrimmed on this tip", () => {
  // Row marshalling is not the inventing write path; do not retarget it here.
  assert.doesNotMatch(
    transportSource,
    /requireCanonicalRecalculationRunTransportRestaurantId\(\s*row\.restaurant_id/
  );
  const run = recalculationRunFromPersistedRow({
    id: "run-1",
    restaurant_id: workspace,
    cycle: "daily_open",
    operating_date: "2026-08-05",
    status: "succeeded",
    attempt: 1,
    job_name: "regenerate_operational_signals",
    monitoring_owner: "manager",
    started_at: "2026-08-05T12:00:00.000Z",
    completed_at: "2026-08-05T12:00:01.000Z",
    duration_ms: 1000,
    timed_out: false,
    failure_reason: null,
    cycle_key: `recalc:${workspace}:2026-08-05:daily_open`,
    idempotency_key: `recalc:${workspace}:2026-08-05:daily_open:attempt-1`,
    recorded_by: "actor-1",
    correlation_id: "corr-1",
    recorded_at: "2026-08-05T12:00:01.000Z"
  });
  assert.equal(run.restaurantId, workspace);
});
