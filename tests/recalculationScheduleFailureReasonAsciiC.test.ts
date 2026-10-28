import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildRecalculationSchedule,
  type RecalculationRunRecord
} from "../services/domain/recalculationSchedule";
import {
  RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS,
  canonicalRecalculationScheduleFailureReason,
  normalizeRecalculationScheduleFailureReason
} from "../services/domain/recalculationScheduleFailureReasonIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/recalculationScheduleFailureReasonIdentity.ts", import.meta.url),
  "utf8"
);
const scheduleSource = readFileSync(
  new URL("../services/domain/recalculationSchedule.ts", import.meta.url),
  "utf8"
);

const restaurantId = "recalc-failure-reason-ascii";
const timeZone = "America/New_York";
const cleanReason = "Timeout while projecting inventory.";
const accentedReason = "Error al proyectar inventario mañana.";
const multilineReason = "Timeout while projecting inventory.\nRetry after lock.\tKeep calm.";

function run(
  overrides: Partial<RecalculationRunRecord> = {}
): RecalculationRunRecord {
  return {
    restaurantId,
    cycle: "daily_open",
    operatingDate: "2026-08-05",
    status: "failed",
    attempt: 1,
    completedAt: "2026-08-05T09:00:00.000Z",
    failureReason: cleanReason,
    ...overrides
  };
}

function decisionFor(
  iso: string,
  runs: RecalculationRunRecord[],
  cycle: RecalculationRunRecord["cycle"] = "daily_open"
) {
  const schedule = buildRecalculationSchedule({
    restaurantId,
    restaurantTimeZone: timeZone,
    runs,
    now: new Date(iso)
  });
  const decision = schedule.decisions.find((entry) => entry.cycle === cycle);
  assert.ok(decision, `expected a decision for ${cycle}`);
  return decision;
}

test("MISE-005SO pins recalculation-schedule failure reasons to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SO/);
  assert.match(scheduleSource, /MISE-005SO/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS = 200/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRecalculationScheduleFailureReason("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    scheduleSource,
    /from "\.\/recalculationScheduleFailureReasonIdentity"/
  );
  assert.match(
    scheduleSource,
    /normalizeRecalculationScheduleFailureReason\(\s*lastFailure\?\.failureReason\s*\)/
  );
  assert.doesNotMatch(scheduleSource, /function normalizeFailureReason\(/);
  assert.doesNotMatch(
    scheduleSource,
    /const trimmed = typeof reason === "string" \? reason\.trim\(\)/
  );

  // Sibling schedule paths stay on their existing contracts in this tip.
  assert.match(scheduleSource, /const restaurantId = input\.restaurantId\.trim\(\);/);
  assert.match(
    scheduleSource,
    /const timeZone = input\.restaurantTimeZone\.trim\(\);/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleTimezoneIdentity/);
  assert.doesNotMatch(identityCode, /recalculationRunTransport/);
  assert.doesNotMatch(identityCode, /scheduledRecalculations/);
  assert.doesNotMatch(identityCode, /sanitizeRecalculationFailureReason/);
  assert.doesNotMatch(identityCode, /describeError/);
  assert.doesNotMatch(identityCode, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(identityCode, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary failure reasons stable", () => {
  assert.equal(canonicalRecalculationScheduleFailureReason(`  ${cleanReason}  `), cleanReason);
  assert.equal(canonicalRecalculationScheduleFailureReason(`\t${cleanReason}\n`), cleanReason);
  assert.equal(normalizeRecalculationScheduleFailureReason(`  ${cleanReason}  `), cleanReason);

  assert.equal(canonicalRecalculationScheduleFailureReason(accentedReason), accentedReason);
  assert.equal(normalizeRecalculationScheduleFailureReason(accentedReason), accentedReason);

  assert.equal(canonicalRecalculationScheduleFailureReason(multilineReason), multilineReason);
  assert.equal(normalizeRecalculationScheduleFailureReason(multilineReason), multilineReason);

  const decision = decisionFor("2026-08-05T12:00:00.000Z", [
    run({ failureReason: `  ${cleanReason}  `, attempt: 1 })
  ]);
  assert.equal(decision.lastFailureReason, cleanReason);
  assert.match(decision.reason, /Retrying the opening recalculation as attempt 2 of 4/);
});

test("NBSP folds and em-space padding cannot invent schedule failure reasons", () => {
  const nbspReason = `\u00a0${cleanReason}\u00a0`;
  const emReason = `\u2003${cleanReason}\u2003`;
  const internalEm = `Timeout\u2003while projecting inventory.`;
  const internalNbsp = `Timeout\u00a0while projecting inventory.`;
  const emMultiline = `\u2003${multilineReason}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspReason.trim(), cleanReason);
  assert.equal(emReason.trim(), cleanReason);

  assert.equal(canonicalRecalculationScheduleFailureReason(nbspReason), cleanReason);
  assert.equal(normalizeRecalculationScheduleFailureReason(nbspReason), cleanReason);
  assert.equal(
    canonicalRecalculationScheduleFailureReason(internalNbsp),
    "Timeout while projecting inventory."
  );

  // Unicode em-space trim invents a clean reason; C free-text prep does not.
  assert.notEqual(canonicalRecalculationScheduleFailureReason(emReason), cleanReason);
  assert.equal(canonicalRecalculationScheduleFailureReason(emReason), emReason);
  assert.equal(normalizeRecalculationScheduleFailureReason(emReason), emReason);
  assert.notEqual(normalizeRecalculationScheduleFailureReason(emReason), cleanReason);

  const decision = decisionFor("2026-08-05T12:00:00.000Z", [
    run({ failureReason: emReason, attempt: 1 })
  ]);
  assert.equal(decision.lastFailureReason, emReason);
  assert.notEqual(decision.lastFailureReason, cleanReason);

  const deadLetter = decisionFor("2026-08-05T12:00:00.000Z", [
    run({ failureReason: emReason, attempt: 1, completedAt: "2026-08-05T09:00:00.000Z" }),
    run({ failureReason: emReason, attempt: 2, completedAt: "2026-08-05T09:05:00.000Z" }),
    run({ failureReason: emReason, attempt: 3, completedAt: "2026-08-05T09:10:00.000Z" }),
    run({ failureReason: emReason, attempt: 4, completedAt: "2026-08-05T09:15:00.000Z" })
  ]);
  assert.equal(deadLetter.state, "dead_lettered");
  assert.equal(deadLetter.lastFailureReason, emReason);
  assert.ok(deadLetter.reason.includes(emReason));
  assert.ok(!deadLetter.reason.includes(` ${cleanReason} `));
  assert.notEqual(deadLetter.lastFailureReason, cleanReason);

  assert.equal(canonicalRecalculationScheduleFailureReason(internalEm), internalEm);
  assert.notEqual(
    canonicalRecalculationScheduleFailureReason(internalEm),
    canonicalRecalculationScheduleFailureReason(cleanReason)
  );

  assert.equal(emMultiline.trim(), multilineReason);
  assert.notEqual(canonicalRecalculationScheduleFailureReason(emMultiline), multilineReason);
  assert.equal(canonicalRecalculationScheduleFailureReason(emMultiline), emMultiline);
  assert.equal(normalizeRecalculationScheduleFailureReason(emMultiline), emMultiline);
});

test("soft empty, unsafe controls, and max length preserve prior normalizeFailureReason contracts", () => {
  assert.equal(normalizeRecalculationScheduleFailureReason(null), null);
  assert.equal(normalizeRecalculationScheduleFailureReason(undefined), null);
  assert.equal(normalizeRecalculationScheduleFailureReason(""), null);
  assert.equal(normalizeRecalculationScheduleFailureReason("   "), null);
  assert.equal(normalizeRecalculationScheduleFailureReason("\u2003\u2003"), null);
  assert.equal(normalizeRecalculationScheduleFailureReason("\u00a0\u00a0"), null);

  assert.equal(normalizeRecalculationScheduleFailureReason("bad\u0000reason"), null);
  assert.equal(normalizeRecalculationScheduleFailureReason("bad\u007freason"), null);
  assert.equal(
    normalizeRecalculationScheduleFailureReason("ok\nline\tbreak"),
    "ok\nline\tbreak"
  );

  const overLong = `x`.repeat(RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS + 40);
  assert.equal(
    normalizeRecalculationScheduleFailureReason(overLong)?.length,
    RECALCULATION_SCHEDULE_FAILURE_REASON_MAX_CHARACTERS
  );

  const emptyDecision = decisionFor("2026-08-05T12:00:00.000Z", [
    run({ failureReason: "\u2003\u2003", attempt: 1 }),
    run({ failureReason: "\u2003\u2003", attempt: 2 }),
    run({ failureReason: "\u2003\u2003", attempt: 3 }),
    run({ failureReason: "\u2003\u2003", attempt: 4 })
  ]);
  assert.equal(emptyDecision.state, "dead_lettered");
  assert.equal(emptyDecision.lastFailureReason, null);
  assert.match(emptyDecision.reason, /No failure reason was recorded/);
});
