import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  runDueRecalculationCycles,
  type RecalculationPorts,
  type RecalculationRunContext
} from "../services/application/recalculationCycles";
import {
  RECALCULATION_DESCRIBE_ERROR_FALLBACK,
  RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS,
  canonicalRecalculationDescribeError,
  describeRecalculationError,
  normalizeRecalculationDescribeError
} from "../services/application/recalculationDescribeErrorIdentity";
import type {
  RecalculationCycle,
  RecalculationRunRecord
} from "../services/domain/recalculationSchedule";

const identitySource = readFileSync(
  new URL("../services/application/recalculationDescribeErrorIdentity.ts", import.meta.url),
  "utf8"
);
const cyclesSource = readFileSync(
  new URL("../services/application/recalculationCycles.ts", import.meta.url),
  "utf8"
);

const restaurantId = "recalc-describe-error-ascii";
const restaurantTimeZone = "America/New_York";
/** 18:00 restaurant time on 2026-08-05: all three windows are open. */
const eveningUtc = new Date("2026-08-05T22:00:00.000Z");
const cleanReason = "Timeout while projecting inventory.";
const accentedReason = "Error al proyectar inventario mañana.";
const multilineReason = "Timeout while projecting inventory.\nRetry after lock.\tKeep calm.";

interface Harness {
  ports: RecalculationPorts;
  recorded: RecalculationRunRecord[];
}

function harness(options: {
  runCycle?: (cycle: RecalculationCycle, context: RecalculationRunContext) => Promise<void>;
  loadRuns?: () => Promise<readonly RecalculationRunRecord[]>;
  recordRun?: (record: RecalculationRunRecord) => Promise<void>;
} = {}): Harness {
  const recorded: RecalculationRunRecord[] = [];
  return {
    recorded,
    ports: {
      loadRuns: options.loadRuns ?? (async () => []),
      recordRun:
        options.recordRun ??
        (async (record) => {
          recorded.push(record);
        }),
      runCycle: options.runCycle ?? (async () => undefined)
    }
  };
}

test("MISE-005SP pins recalculation describeError haystacks to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005SP/);
  assert.match(cyclesSource, /MISE-005SP/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    identitySource,
    /RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS = 200/
  );
  assert.match(
    identitySource,
    /RECALCULATION_DESCRIBE_ERROR_FALLBACK = "Unknown recalculation failure"/
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalRecalculationDescribeError("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);
  assert.doesNotMatch(canonicalBody, /replace\(C_WHITESPACE/);

  assert.match(
    cyclesSource,
    /from "\.\/recalculationDescribeErrorIdentity"/
  );
  assert.match(cyclesSource, /return describeRecalculationError\(error\);/);
  assert.doesNotMatch(
    cyclesSource,
    /if \(error instanceof Error && error\.message\.trim\(\)\) return error\.message\.trim\(\)\.slice\(0, 200\);/
  );
  assert.doesNotMatch(
    cyclesSource,
    /const text = typeof error === "string" \? error\.trim\(\) : "";/
  );

  // Do not rewrite sibling tips / modules (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identityCode, /recalculationScheduleTimezoneIdentity/);
  assert.doesNotMatch(identityCode, /recalculationRunTransport/);
  assert.doesNotMatch(identityCode, /scheduledRecalculations/);
  assert.doesNotMatch(identityCode, /sanitizeRecalculationFailureReason/);
  assert.doesNotMatch(identityCode, /operatingPlanWhyIdentity/);
  assert.doesNotMatch(identityCode, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
});

test("ASCII C free-text prep keeps ordinary describeError haystacks stable", () => {
  assert.equal(canonicalRecalculationDescribeError(`  ${cleanReason}  `), cleanReason);
  assert.equal(canonicalRecalculationDescribeError(`\t${cleanReason}\n`), cleanReason);
  assert.equal(normalizeRecalculationDescribeError(`  ${cleanReason}  `), cleanReason);

  assert.equal(canonicalRecalculationDescribeError(accentedReason), accentedReason);
  assert.equal(normalizeRecalculationDescribeError(accentedReason), accentedReason);

  assert.equal(canonicalRecalculationDescribeError(multilineReason), multilineReason);
  assert.equal(normalizeRecalculationDescribeError(multilineReason), multilineReason);

  assert.equal(describeRecalculationError(new Error(`  ${cleanReason}  `)), cleanReason);
  assert.equal(describeRecalculationError(`  ${cleanReason}  `), cleanReason);
  assert.equal(describeRecalculationError(new Error(accentedReason)), accentedReason);
  assert.equal(describeRecalculationError(new Error(multilineReason)), multilineReason);
});

test("NBSP folds and em-space padding cannot invent describeError haystacks", async () => {
  const nbspReason = `\u00a0${cleanReason}\u00a0`;
  const emReason = `\u2003${cleanReason}\u2003`;
  const internalEm = `Timeout\u2003while projecting inventory.`;
  const internalNbsp = `Timeout\u00a0while projecting inventory.`;
  const emMultiline = `\u2003${multilineReason}\u2003`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(nbspReason.trim(), cleanReason);
  assert.equal(emReason.trim(), cleanReason);

  assert.equal(canonicalRecalculationDescribeError(nbspReason), cleanReason);
  assert.equal(normalizeRecalculationDescribeError(nbspReason), cleanReason);
  assert.equal(describeRecalculationError(new Error(nbspReason)), cleanReason);
  assert.equal(
    canonicalRecalculationDescribeError(internalNbsp),
    "Timeout while projecting inventory."
  );

  // Unicode em-space trim invents a clean reason; C free-text prep does not.
  assert.notEqual(canonicalRecalculationDescribeError(emReason), cleanReason);
  assert.equal(canonicalRecalculationDescribeError(emReason), emReason);
  assert.equal(normalizeRecalculationDescribeError(emReason), emReason);
  assert.notEqual(normalizeRecalculationDescribeError(emReason), cleanReason);
  assert.equal(describeRecalculationError(new Error(emReason)), emReason);
  assert.notEqual(describeRecalculationError(new Error(emReason)), cleanReason);
  assert.equal(describeRecalculationError(emReason), emReason);

  const test1 = harness({
    runCycle: async (cycle) => {
      if (cycle === "mid_shift") throw new Error(emReason);
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: test1.ports,
    now: eveningUtc
  });
  const midShift = report.executions.find((execution) => execution.cycle === "mid_shift");
  assert.equal(midShift?.status, "failed");
  assert.equal(midShift?.failureReason, emReason);
  assert.notEqual(midShift?.failureReason, cleanReason);
  assert.equal(
    test1.recorded.find((record) => record.cycle === "mid_shift")?.failureReason,
    emReason
  );

  const ledger = harness({
    loadRuns: async () => {
      throw new Error(emReason);
    }
  });
  const scheduleReport = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: ledger.ports,
    now: eveningUtc
  });
  assert.equal(scheduleReport.scheduleError, emReason);
  assert.notEqual(scheduleReport.scheduleError, cleanReason);

  assert.equal(canonicalRecalculationDescribeError(internalEm), internalEm);
  assert.notEqual(
    canonicalRecalculationDescribeError(internalEm),
    canonicalRecalculationDescribeError(cleanReason)
  );

  assert.equal(emMultiline.trim(), multilineReason);
  assert.notEqual(canonicalRecalculationDescribeError(emMultiline), multilineReason);
  assert.equal(canonicalRecalculationDescribeError(emMultiline), emMultiline);
  assert.equal(normalizeRecalculationDescribeError(emMultiline), emMultiline);
  assert.equal(describeRecalculationError(new Error(emMultiline)), emMultiline);
});

test("soft empty, unsafe controls, and max length preserve prior describeError contracts", async () => {
  assert.equal(normalizeRecalculationDescribeError(null), null);
  assert.equal(normalizeRecalculationDescribeError(undefined), null);
  assert.equal(normalizeRecalculationDescribeError(""), null);
  assert.equal(normalizeRecalculationDescribeError("   "), null);
  assert.equal(normalizeRecalculationDescribeError("\u2003\u2003"), null);
  assert.equal(normalizeRecalculationDescribeError("\u00a0\u00a0"), null);
  assert.equal(normalizeRecalculationDescribeError("\u0000bad"), null);
  assert.equal(normalizeRecalculationDescribeError("bad\u0007"), null);

  assert.equal(describeRecalculationError(new Error("")), RECALCULATION_DESCRIBE_ERROR_FALLBACK);
  assert.equal(describeRecalculationError(new Error("   ")), RECALCULATION_DESCRIBE_ERROR_FALLBACK);
  assert.equal(
    describeRecalculationError(new Error("\u2003\u2003")),
    RECALCULATION_DESCRIBE_ERROR_FALLBACK
  );
  assert.equal(describeRecalculationError(""), RECALCULATION_DESCRIBE_ERROR_FALLBACK);
  assert.equal(describeRecalculationError(null), RECALCULATION_DESCRIBE_ERROR_FALLBACK);
  assert.equal(describeRecalculationError(42), RECALCULATION_DESCRIBE_ERROR_FALLBACK);
  assert.equal(
    describeRecalculationError(new Error("bad\u0000")),
    RECALCULATION_DESCRIBE_ERROR_FALLBACK
  );

  const longClean = `${"a".repeat(RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS)}EXTRA`;
  assert.equal(
    normalizeRecalculationDescribeError(longClean)?.length,
    RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS
  );
  assert.equal(
    describeRecalculationError(new Error(longClean)).length,
    RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS
  );

  const longEm = `\u2003${"b".repeat(RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS + 20)}\u2003`;
  const preparedLongEm = normalizeRecalculationDescribeError(longEm);
  assert.ok(preparedLongEm);
  assert.equal(preparedLongEm.length, RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS);
  assert.equal(preparedLongEm.startsWith("\u2003"), true);
  assert.notEqual(preparedLongEm, "b".repeat(RECALCULATION_DESCRIBE_ERROR_MAX_CHARACTERS));

  const unknown = harness({
    runCycle: async (cycle) => {
      if (cycle === "close") throw new Error("\u2003\u2003");
    }
  });
  const report = await runDueRecalculationCycles({
    restaurantId,
    restaurantTimeZone,
    ports: unknown.ports,
    now: eveningUtc
  });
  const close = report.executions.find((execution) => execution.cycle === "close");
  assert.equal(close?.status, "failed");
  assert.equal(close?.failureReason, RECALCULATION_DESCRIBE_ERROR_FALLBACK);
});
