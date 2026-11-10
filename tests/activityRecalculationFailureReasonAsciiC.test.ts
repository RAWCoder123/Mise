import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fromRecalculationRunActivity } from "../services/domain/activityEvents";
import {
  canonicalActivityRecalculationFailureReason,
  normalizeActivityRecalculationFailureReason
} from "../services/domain/activityRecalculationFailureReasonIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/activityRecalculationFailureReasonIdentity.ts", import.meta.url),
  "utf8"
);
const activityEventsSource = readFileSync(
  new URL("../services/domain/activityEvents.ts", import.meta.url),
  "utf8"
);
const scheduleFailureReasonIdentityPath = new URL(
  "../services/domain/recalculationScheduleFailureReasonIdentity.ts",
  import.meta.url
);
const describeErrorIdentityPath = new URL(
  "../services/domain/recalculationDescribeErrorIdentity.ts",
  import.meta.url
);

const em = "\u2003";
const nbsp = "\u00a0";
const cleanReason = "Timeout while projecting inventory.";
const accentedReason = "Error al proyectar inventario mañana.";
const multilineReason = "Timeout while projecting inventory.\nRetry after lock.\tKeep calm.";
const fallbackCopy = "No failure reason was recorded.";

function filePresence(path: URL) {
  try {
    readFileSync(path, "utf8");
    return "present";
  } catch {
    return "absent";
  }
}

function failedRun(
  overrides: Partial<{
    failureReason: string | null;
    cycle: string;
    attempt: number;
    maxAttempts: number;
    timedOut: boolean;
  }> = {}
) {
  return {
    id: "recalc-run-activity-ascii",
    restaurantId: "restaurant-activity-ascii",
    cycle: "daily_open",
    operatingDate: "2026-11-10",
    status: "failed" as const,
    attempt: 2,
    maxAttempts: 4,
    jobName: "recalculation.daily_open",
    monitoringOwner: "ops",
    completedAt: "2026-11-10T14:00:00.000Z",
    durationMs: 1200,
    timedOut: false,
    failureReason: cleanReason,
    cycleKey: "2026-11-10:daily_open",
    ...overrides
  };
}

test("MISE-005ABV pins Activity recalculation failureReason to ASCII C free-text prep", () => {
  assert.match(identitySource, /MISE-005ABV/);
  assert.match(activityEventsSource, /MISE-005ABV/);

  assert.match(identitySource, /C_LEADING_WHITESPACE = \/\^\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(identitySource, /C_TRAILING_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\$\//);
  assert.match(identitySource, /replace\(\/\\u00a0\/g, " "\)/);
  assert.match(
    identitySource,
    /UNSAFE_MULTILINE_CONTROL = \/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );

  const canonicalBody = identitySource.slice(
    identitySource.indexOf("export function canonicalActivityRecalculationFailureReason("),
    identitySource.indexOf("function hasUnsafeMultilineControls(")
  );
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(
    activityEventsSource,
    /from "\.\/activityRecalculationFailureReasonIdentity"/
  );
  assert.match(
    activityEventsSource,
    /normalizeActivityRecalculationFailureReason\(\s*run\.failureReason\s*\)/
  );
  assert.match(
    activityEventsSource,
    /normalizeActivityRecalculationFailureReason\(run\.failureReason\) \?\?\s*"No failure reason was recorded\."/
  );
  assert.match(
    activityEventsSource,
    /errorMessage:\s*succeeded\s*\?\s*null\s*:\s*normalizeActivityRecalculationFailureReason\(run\.failureReason\)/
  );

  // Prior always-pass / Unicode-trim inventing sinks must not remain.
  assert.doesNotMatch(
    activityEventsSource,
    /run\.failureReason \?\? "No failure reason was recorded\."/
  );
  assert.doesNotMatch(activityEventsSource, /errorMessage: succeeded \? null : run\.failureReason/);

  // Cycle underscore-humanize stays on the prior always-pass path this tip.
  assert.match(
    activityEventsSource,
    /run\.cycle\.replace\(\/_\/g, " "\)/
  );

  // Sibling tips / modules stay alone (imports / executable code only).
  const identityCode = identitySource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(identityCode, /recalculationScheduleFailureReasonIdentity/);
  assert.doesNotMatch(identityCode, /normalizeRecalculationScheduleFailureReason/);
  assert.doesNotMatch(identityCode, /describeError/);
  assert.doesNotMatch(identityCode, /sanitizeRecalculationFailureReason/);
  assert.doesNotMatch(identityCode, /recalculationScheduleRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /^import /m);
  assert.equal(filePresence(scheduleFailureReasonIdentityPath), "absent");
  assert.equal(filePresence(describeErrorIdentityPath), "absent");
});

test("ASCII C free-text prep keeps ordinary Activity recalculation failure reasons stable", () => {
  assert.equal(canonicalActivityRecalculationFailureReason(`  ${cleanReason}  `), cleanReason);
  assert.equal(canonicalActivityRecalculationFailureReason(`\t${cleanReason}\n`), cleanReason);
  assert.equal(normalizeActivityRecalculationFailureReason(`  ${cleanReason}  `), cleanReason);

  assert.equal(canonicalActivityRecalculationFailureReason(accentedReason), accentedReason);
  assert.equal(normalizeActivityRecalculationFailureReason(accentedReason), accentedReason);

  assert.equal(canonicalActivityRecalculationFailureReason(multilineReason), multilineReason);
  assert.equal(normalizeActivityRecalculationFailureReason(multilineReason), multilineReason);

  const event = fromRecalculationRunActivity(failedRun({ failureReason: `  ${cleanReason}  ` }));
  assert.ok(event);
  assert.match(event!.summary, new RegExp(cleanReason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(event!.summary, new RegExp(fallbackCopy));
  assert.equal(event!.errorMessage, cleanReason);
});

test("Unicode-only space cannot invent blank-looking Activity recalculation failure reasons", () => {
  const unicodeOnly = `${em}${em}`;
  const nbspOnly = `${nbsp}`;
  const empty = "";

  // Prior always-pass path: truthy Unicode-only space bypassed `??` fallback.
  assert.equal(Boolean(unicodeOnly), true);
  assert.equal(Boolean(nbspOnly), true);
  assert.notEqual(unicodeOnly, "");
  assert.equal(unicodeOnly ?? fallbackCopy, unicodeOnly);

  assert.equal(normalizeActivityRecalculationFailureReason(unicodeOnly), null);
  assert.equal(normalizeActivityRecalculationFailureReason(nbspOnly), null);
  assert.equal(normalizeActivityRecalculationFailureReason(empty), null);
  assert.equal(normalizeActivityRecalculationFailureReason(null), null);
  assert.equal(normalizeActivityRecalculationFailureReason(undefined), null);
  assert.equal(normalizeActivityRecalculationFailureReason("   "), null);

  const unicodeEvent = fromRecalculationRunActivity(
    failedRun({ failureReason: unicodeOnly })
  );
  assert.ok(unicodeEvent);
  assert.match(unicodeEvent!.summary, new RegExp(fallbackCopy));
  assert.doesNotMatch(unicodeEvent!.summary, /\u2003/);
  assert.equal(unicodeEvent!.errorMessage, null);

  const nullEvent = fromRecalculationRunActivity(failedRun({ failureReason: null }));
  assert.ok(nullEvent);
  assert.match(nullEvent!.summary, new RegExp(fallbackCopy));
  assert.equal(nullEvent!.errorMessage, null);
});

test("Unicode em-space / NBSP padding cannot invent clean Activity recalculation failure reasons", () => {
  const padded = `${em}${cleanReason}${em}`;
  const nbspReason = `${nbsp}${cleanReason}${nbsp}`;
  const internalEm = `Timeout${em}while projecting inventory.`;
  const internalNbsp = `Timeout${nbsp}while projecting inventory.`;
  const emMultiline = `${em}${multilineReason}${em}`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(padded.trim(), cleanReason);
  assert.equal(nbspReason.trim(), cleanReason);
  assert.equal(Boolean(padded), true);

  assert.equal(canonicalActivityRecalculationFailureReason(nbspReason), cleanReason);
  assert.equal(normalizeActivityRecalculationFailureReason(nbspReason), cleanReason);

  // Em-space end padding is not C-space; soft-null so padding cannot invent
  // equality with an unpadded diagnostic.
  assert.equal(canonicalActivityRecalculationFailureReason(padded), padded);
  assert.equal(normalizeActivityRecalculationFailureReason(padded), null);
  assert.equal(normalizeActivityRecalculationFailureReason(emMultiline), null);

  // Internal Unicode spaces are preserved by canonical prep; NBSP folds.
  assert.equal(canonicalActivityRecalculationFailureReason(internalEm), internalEm);
  assert.equal(normalizeActivityRecalculationFailureReason(internalEm), internalEm);
  assert.equal(
    canonicalActivityRecalculationFailureReason(internalNbsp),
    "Timeout while projecting inventory."
  );
  assert.equal(
    normalizeActivityRecalculationFailureReason(internalNbsp),
    "Timeout while projecting inventory."
  );

  const paddedEvent = fromRecalculationRunActivity(failedRun({ failureReason: padded }));
  assert.ok(paddedEvent);
  assert.match(paddedEvent!.summary, new RegExp(fallbackCopy));
  assert.equal(paddedEvent!.errorMessage, null);

  const nbspEvent = fromRecalculationRunActivity(failedRun({ failureReason: nbspReason }));
  assert.ok(nbspEvent);
  assert.match(nbspEvent!.summary, new RegExp(cleanReason.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(nbspEvent!.errorMessage, cleanReason);
});

test("control-bearing and non-string Activity recalculation failure reasons fail closed", () => {
  assert.equal(
    normalizeActivityRecalculationFailureReason(`\u0001${cleanReason}`),
    null
  );
  assert.equal(
    normalizeActivityRecalculationFailureReason(`${cleanReason}\u0007`),
    null
  );
  assert.equal(
    normalizeActivityRecalculationFailureReason(123 as unknown as string),
    null
  );

  // Trailing ASCII tab trims clean; LF/TAB/CR inside multiline survive.
  assert.equal(
    normalizeActivityRecalculationFailureReason(`${cleanReason}\t`),
    cleanReason
  );
  assert.equal(normalizeActivityRecalculationFailureReason(multilineReason), multilineReason);

  const controlEvent = fromRecalculationRunActivity(
    failedRun({ failureReason: `\u0001${cleanReason}` })
  );
  assert.ok(controlEvent);
  assert.match(controlEvent!.summary, new RegExp(fallbackCopy));
  assert.equal(controlEvent!.errorMessage, null);

  // Success path still omits failureReason and leaves cycle humanize alone.
  const success = fromRecalculationRunActivity({
    ...failedRun(),
    status: "succeeded",
    failureReason: null
  });
  assert.ok(success);
  assert.equal(success!.errorMessage, null);
  assert.doesNotMatch(success!.summary, /Attempt/);
});
