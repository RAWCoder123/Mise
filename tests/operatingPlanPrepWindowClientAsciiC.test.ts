import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildServiceWindowDescriptors,
  normalizeOperatingPlanPrepWindowToken
} from "../services/domain/operatingPlan";

const domainSource = readFileSync(
  new URL("../services/domain/operatingPlan.ts", import.meta.url),
  "utf8"
);

test("MISE-005JO pins operatingPlan prep-window token normalize to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JO/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeOperatingPlanPrepWindowToken("),
    domainSource.indexOf("function evidenceFromPrepWindows(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    domainSource,
    /const token = normalizeOperatingPlanPrepWindowToken\(raw\);/
  );
  assert.doesNotMatch(
    domainSource,
    /raw\.trim\(\)\.toLocaleLowerCase\("en-US"\)/
  );
  assert.doesNotMatch(
    domainSource,
    /raw\.trim\(\)\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary prep-window tokens stable", () => {
  assert.equal(normalizeOperatingPlanPrepWindowToken("  AM  "), "am");
  assert.equal(normalizeOperatingPlanPrepWindowToken("Dinner"), "dinner");
  assert.equal(normalizeOperatingPlanPrepWindowToken("LUNCH"), "lunch");
  assert.equal(
    normalizeOperatingPlanPrepWindowToken("Before Prep"),
    "before prep"
  );

  const windows = buildServiceWindowDescriptors(["AM", "Dinner", "Lunch", "Rush"]);
  assert.equal(
    windows.find((window) => window.id === "before_prep")?.evidence,
    "AM"
  );
  assert.equal(
    windows.find((window) => window.id === "before_dinner")?.evidence,
    "Dinner"
  );
  assert.equal(
    windows.find((window) => window.id === "before_lunch")?.evidence,
    "Lunch"
  );
  assert.equal(
    windows.find((window) => window.id === "during_service")?.evidence,
    "Rush"
  );
});

test("ASCII C fold does not invent Kelvin-sign or NBSP prep-window identity", () => {
  // Unicode toLowerCase would fold K → k.
  assert.equal(normalizeOperatingPlanPrepWindowToken("Kunch"), "Kunch");
  assert.notEqual(
    normalizeOperatingPlanPrepWindowToken("Kunch"),
    normalizeOperatingPlanPrepWindowToken("Lunch")
  );

  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.equal(
    normalizeOperatingPlanPrepWindowToken("\u00a0AM\u00a0"),
    "\u00a0am\u00a0"
  );
  assert.notEqual(
    normalizeOperatingPlanPrepWindowToken("\u00a0AM\u00a0"),
    normalizeOperatingPlanPrepWindowToken("AM")
  );

  const invented = buildServiceWindowDescriptors(["\u00a0AM\u00a0", "Kunch"]);
  assert.equal(
    invented.find((window) => window.id === "before_prep")?.evidence ?? null,
    null
  );
  assert.equal(
    invented.find((window) => window.id === "before_lunch")?.evidence ?? null,
    null
  );
});
