import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fromRecalculationRunActivity } from "../services/domain/activityEvents";
import {
  asciiTrimActivityRecalculationCycle,
  canonicalizeActivityRecalculationCycle,
  normalizeActivityRecalculationCycle
} from "../services/domain/activityRecalculationCycleIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/activityRecalculationCycleIdentity.ts", import.meta.url),
  "utf8"
);
const activityEventsSource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);
const failureReasonIdentityPath = new URL(
  "../services/domain/activityRecalculationFailureReasonIdentity.ts",
  import.meta.url
);

const cycle = "daily_open";
const em = "\u2003";
const nbsp = "\u00a0";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

function failedRun(overrides: Partial<Parameters<typeof fromRecalculationRunActivity>[0]> = {}) {
  return fromRecalculationRunActivity({
    id: "run-1",
    restaurantId: "restaurant-1",
    cycle,
    operatingDate: "2026-11-10",
    status: "failed",
    attempt: 1,
    maxAttempts: 3,
    jobName: "recalculation.daily_open",
    monitoringOwner: "manager",
    completedAt: "2026-11-10T09:05:00.000Z",
    durationMs: 1200,
    timedOut: false,
    failureReason: "POS sync timed out",
    cycleKey: "recalc:restaurant-1:2026-11-10:daily_open",
    ...overrides
  });
}

test("MISE-005ABW pins Activity recalculation cycle to ASCII C", () => {
  assert.match(identitySource, /MISE-005ABW/);
  assert.match(activityEventsSource, /MISE-005ABW/);

  assert.match(
    identitySource,
    /export function asciiTrimActivityRecalculationCycle\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    activityEventsSource,
    /from "\.\/activityRecalculationCycleIdentity"/
  );
  assert.match(activityEventsSource, /normalizeActivityRecalculationCycle\(/);
  assert.match(activityEventsSource, /activityRecalculationDisplayCycle/);
  assert.match(
    activityEventsSource,
    /normalizeActivityRecalculationCycle\(\s*run\.cycle\s*\)\s*\?\?\s*"unknown"/
  );
  assert.match(
    activityEventsSource,
    /\$\{activityRecalculationDisplayCycle\.replace\(\/_\/g, " "\)\} recalculation did not complete/
  );
  assert.doesNotMatch(
    activityEventsSource,
    /\$\{run\.cycle\.replace\(\/_\/g, " "\)\} recalculation did not complete/
  );

  // Leave sibling failureReason tip alone (open #1232 / MISE-005ABV).
  assert.doesNotMatch(activityEventsSource, /normalizeActivityRecalculationFailureReason/);
  assert.doesNotMatch(identitySource, /activityRecalculationFailureReasonIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(failureReasonIdentityPath), "absent");

  // Leave failureReason still on prior always-pass / nullish fallthrough (main).
  assert.match(
    activityEventsSource,
    /run\.failureReason \?\? "No failure reason was recorded\."/
  );

  // Raw authority fields still consume run.cycle directly.
  assert.match(activityEventsSource, /sequenceId: `recalculation:\$\{run\.operatingDate\}:\$\{run\.cycle\}`/);
  assert.match(activityEventsSource, /cycle: run\.cycle,/);
  assert.match(activityEventsSource, /if \(succeeded && run\.cycle !== "daily_open"\) return null;/);

  assert.equal(normalizeActivityRecalculationCycle(cycle), cycle);
  assert.equal(normalizeActivityRecalculationCycle(` ${cycle} `), cycle);
  assert.equal(
    normalizeActivityRecalculationCycle(`mid ${cycle}`),
    `mid ${cycle}`
  );
  assert.equal(normalizeActivityRecalculationCycle("mid_shift"), "mid_shift");
  assert.equal(normalizeActivityRecalculationCycle("close"), "close");
});

test("Unicode padding invents via trim and is soft-nulled for Activity recalculation cycle", () => {
  const padded = `${em}${cycle}${em}`;
  const nbspName = `${nbsp}${cycle}${nbsp}`;
  const internalEm = `daily${em}open`;
  const internalNbsp = `daily${nbsp}open`;

  // Inventing proof: Unicode trim would invent the clean cycle.
  assert.equal(padded.trim(), cycle);
  assert.equal(nbspName.trim(), cycle);
  assert.equal(Boolean(padded), true);
  assert.equal(Boolean(nbspName), true);

  // Prior always-pass path would still humanize a padded cycle into
  // blank-looking / padded display copy (em-space preserved; underscore
  // replaced), inventing clean equality only via Unicode trim.
  assert.equal(Boolean(padded.trim()), true);
  assert.equal(padded.replace(/_/g, " "), `${em}daily open${em}`);

  // ASCII C prep refuses that inventing equality.
  assert.equal(asciiTrimActivityRecalculationCycle(padded), padded);
  assert.equal(canonicalizeActivityRecalculationCycle(padded), null);
  assert.equal(canonicalizeActivityRecalculationCycle(nbspName), null);
  assert.equal(normalizeActivityRecalculationCycle(padded), null);
  assert.equal(normalizeActivityRecalculationCycle(nbspName), null);
  assert.equal(normalizeActivityRecalculationCycle(padded) ?? "unknown", "unknown");

  // Internal Unicode spaces are not stripped; they remain durable content.
  assert.equal(canonicalizeActivityRecalculationCycle(internalEm), internalEm);
  assert.equal(normalizeActivityRecalculationCycle(internalNbsp), internalNbsp);
  assert.equal(normalizeActivityRecalculationCycle(internalEm), internalEm);
});

test("soft empty, controls, and non-strings fail closed for Activity recalculation cycle", () => {
  assert.equal(normalizeActivityRecalculationCycle(undefined), null);
  assert.equal(normalizeActivityRecalculationCycle(null), null);
  assert.equal(normalizeActivityRecalculationCycle(""), null);
  assert.equal(normalizeActivityRecalculationCycle("   "), null);
  assert.equal(normalizeActivityRecalculationCycle(123 as unknown as string), null);
  assert.equal(normalizeActivityRecalculationCycle(`\u0001${cycle}`), null);
  // Trailing ASCII tab is end-trimmed, not treated as an embedded control.
  assert.equal(normalizeActivityRecalculationCycle(`${cycle}\t`), cycle);
  assert.equal(normalizeActivityRecalculationCycle(`${cycle}\u0007`), null);
  assert.equal(normalizeActivityRecalculationCycle(em), null);
});

test("Activity recalculation cycle bypass proof: empty and Unicode-only-space soft-null to unknown", () => {
  // Prior always-pass path still rendered blank-looking cycle identity in
  // the failure summary (`"Attempt N of the   recalculation…"`). Soft-null
  // restores the intentional "unknown" cycle fallthrough.
  assert.equal(normalizeActivityRecalculationCycle(""), null);
  assert.equal(normalizeActivityRecalculationCycle(em), null);
  assert.equal(normalizeActivityRecalculationCycle(nbsp), null);
  assert.match(
    activityEventsSource,
    /normalizeActivityRecalculationCycle\(\s*run\.cycle\s*\)\s*\?\?\s*"unknown"/
  );
  assert.match(
    activityEventsSource,
    /\$\{activityRecalculationDisplayCycle\.replace\(\/_\/g, " "\)\} recalculation did not complete/
  );

  const blankLooking = failedRun({ cycle: em });
  assert.ok(blankLooking);
  assert.match(blankLooking.summary, /of the unknown recalculation did not complete/);
  assert.doesNotMatch(blankLooking.summary, /of the \u2003 recalculation/);
  // Raw metadata/authority still preserve the unsafe cycle token.
  assert.equal(blankLooking.metadata.cycle, em);
  assert.equal(blankLooking.sequenceId, "recalculation:2026-11-10:\u2003");

  const ordinary = failedRun({ cycle: "mid_shift" });
  assert.ok(ordinary);
  assert.match(ordinary.summary, /of the mid shift recalculation did not complete/);
  assert.equal(ordinary.metadata.cycle, "mid_shift");
});

test("Activity recalculation cycle identity refuses Unicode inventing equality", () => {
  const padded = `${em}${cycle}${em}`;
  assert.notEqual(asciiTrimActivityRecalculationCycle(padded), padded.trim());
  assert.equal(normalizeActivityRecalculationCycle(padded), null);
  assert.equal(normalizeActivityRecalculationCycle(`\t${cycle}\n`), cycle);

  const paddedEvent = failedRun({ cycle: padded });
  assert.ok(paddedEvent);
  assert.match(paddedEvent.summary, /of the unknown recalculation did not complete/);
  assert.doesNotMatch(paddedEvent.summary, /of the daily open recalculation/);
  assert.equal(paddedEvent.metadata.cycle, padded);
});
