import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimAutonomyAllowedTime,
  canonicalizeAutonomyAllowedTime,
  normalizeAutonomyAllowedTime
} from "../services/domain/autonomyAllowedTimeIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/autonomyAllowedTimeIdentity.ts", import.meta.url),
  "utf8"
);
const screenSource = readFileSync(
  new URL("../app/settings/autonomy.tsx", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/autonomy.ts", import.meta.url),
  "utf8"
);

const clock = "09:00";
const clockWithSeconds = "09:00:00";

test("MISE-005QR pins autonomy allowed-window time identity to ASCII C", () => {
  assert.match(identitySource, /MISE-005QR/);
  assert.match(screenSource, /MISE-005QR/);

  assert.match(
    identitySource,
    /export function asciiTrimAutonomyAllowedTime\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    screenSource,
    /from "\.\.\/\.\.\/services\/domain\/autonomyAllowedTimeIdentity"/
  );
  assert.match(screenSource, /normalizeAutonomyAllowedTime\(draft\.allowedStartTime\)/);
  assert.match(screenSource, /normalizeAutonomyAllowedTime\(draft\.allowedEndTime\)/);
  assert.doesNotMatch(screenSource, /function normalizeTime\(/);
  assert.doesNotMatch(screenSource, /allowedStartTime: normalizeTime\(/);
  assert.doesNotMatch(screenSource, /allowedEndTime: normalizeTime\(/);

  // Leave open autonomy restaurant-workspace tip #741 on its existing trim path.
  assert.match(applicationSource, /const normalizedRestaurantId = restaurantId\.trim\(\);/);

  // Do not rewrite sibling tips through this module.
  assert.doesNotMatch(identitySource, /normalizeAutonomyCommunicationType/);
  assert.doesNotMatch(identitySource, /normalizeLoginEmail/);
  assert.doesNotMatch(identitySource, /from ["']\.\/restaurantAutonomy["']/);
  assert.doesNotMatch(screenSource, /from "\.\.\/\.\.\/services\/domain\/loginEmailIdentity"/);

  // Leave the screen's communicationType prep on its existing Unicode-trim contract
  // (owned by open tip #877 / MISE-005QQ).
  assert.match(screenSource, /draft\.communicationType\.trim\(\)/);
});

test("ASCII trim keeps ordinary autonomy allowed-window clocks stable", () => {
  assert.equal(asciiTrimAutonomyAllowedTime(`  ${clock}  `), clock);
  assert.equal(canonicalizeAutonomyAllowedTime(`\t${clock}\n`), clockWithSeconds);
  assert.equal(normalizeAutonomyAllowedTime(`  ${clock}  `), clockWithSeconds);
  assert.equal(normalizeAutonomyAllowedTime(clock), clockWithSeconds);
  assert.equal(normalizeAutonomyAllowedTime(clockWithSeconds), clockWithSeconds);
  assert.equal(normalizeAutonomyAllowedTime("17:30:45"), "17:30:45");

  // Prior emptiness contract: ASCII-only whitespace softs to null.
  assert.equal(normalizeAutonomyAllowedTime("   "), null);
  assert.equal(normalizeAutonomyAllowedTime("\t\n"), null);
  assert.equal(normalizeAutonomyAllowedTime(""), null);
  assert.equal(normalizeAutonomyAllowedTime(null), null);
  assert.equal(normalizeAutonomyAllowedTime(undefined), null);
});

test("NBSP and em-space padding cannot invent a clean autonomy allowed-window clock", () => {
  const nbspClock = `\u00a0${clock}\u00a0`;
  const emClock = `\u2003${clock}\u2003`;
  const emClockWithSeconds = `\u2003${clockWithSeconds}\u2003`;

  // Live inventing proof on Unicode trim (what autonomy.tsx used before this tip).
  assert.equal(nbspClock.trim(), clock);
  assert.equal(emClock.trim(), clock);
  assert.equal(emClockWithSeconds.trim(), clockWithSeconds);

  assert.equal(canonicalizeAutonomyAllowedTime(nbspClock), null);
  assert.equal(canonicalizeAutonomyAllowedTime(emClock), null);
  assert.equal(canonicalizeAutonomyAllowedTime(emClockWithSeconds), null);
  assert.equal(normalizeAutonomyAllowedTime(nbspClock), null);
  assert.equal(normalizeAutonomyAllowedTime(emClock), null);
  assert.equal(normalizeAutonomyAllowedTime(emClockWithSeconds), null);

  // Soft empty Unicode-only padding falls through like prior `.trim()` emptiness.
  assert.equal(normalizeAutonomyAllowedTime("\u2003\u2003"), null);
  assert.equal(normalizeAutonomyAllowedTime("\u00a0\u00a0"), null);

  // Padded and clean stay distinct — do not invent clock equality.
  assert.notEqual(normalizeAutonomyAllowedTime(nbspClock), clockWithSeconds);
  assert.notEqual(normalizeAutonomyAllowedTime(emClock), clockWithSeconds);
});

test("ASCII controls and malformed clocks fail closed without inventing", () => {
  assert.equal(canonicalizeAutonomyAllowedTime("09\n:00"), null);
  assert.equal(canonicalizeAutonomyAllowedTime("09\r:00"), null);
  assert.equal(canonicalizeAutonomyAllowedTime("09\x01:00"), null);
  assert.equal(canonicalizeAutonomyAllowedTime("09\x7f:00"), null);
  assert.equal(normalizeAutonomyAllowedTime("09\n:00"), null);
  assert.equal(normalizeAutonomyAllowedTime("09\x7f:00"), null);

  assert.equal(normalizeAutonomyAllowedTime("9:00"), null);
  assert.equal(normalizeAutonomyAllowedTime("09:0"), null);
  assert.equal(normalizeAutonomyAllowedTime("09:00:0"), null);
  assert.equal(normalizeAutonomyAllowedTime("not-a-time"), null);
  assert.equal(normalizeAutonomyAllowedTime("09:00:00:00"), null);

  // Prior format gate accepted HH:MM structurally; preserve that contract.
  assert.equal(normalizeAutonomyAllowedTime("25:00"), "25:00:00");
});
