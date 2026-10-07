import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createMemoryFromLearningSignals,
  normalizeRestaurantMemoryLearningSignalToken,
  restaurantMemoryLearningSignalHaystack
} from "../services/domain/restaurantMemory";
import type { LearningMemorySummary } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/restaurantMemory.ts", import.meta.url),
  "utf8"
);

test("MISE-005KD pins restaurantMemory learning-signal classify to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005KD/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = domainSource.slice(
    domainSource.indexOf("export function normalizeRestaurantMemoryLearningSignalToken("),
    domainSource.indexOf("export function restaurantMemoryLearningSignalHaystack(")
  );

  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  assert.match(
    domainSource,
    /const haystack = restaurantMemoryLearningSignalHaystack\(signal\);/
  );
  assert.doesNotMatch(
    domainSource,
    /\$\{signal\.label\} \$\{signal\.detail\}\`\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary learning-signal classification stable", () => {
  assert.equal(normalizeRestaurantMemoryLearningSignalToken("  Waste  "), "waste");
  assert.equal(normalizeRestaurantMemoryLearningSignalToken("SUPPLIER"), "supplier");
  assert.equal(
    restaurantMemoryLearningSignalHaystack({
      label: "Prep timing",
      detail: "Line prep starts earlier on Fridays."
    }),
    "prep timing line prep starts earlier on fridays."
  );

  const summary: LearningMemorySummary = {
    score: 70,
    label: "Learning",
    operatorCopy: "Mise is learning.",
    nextStep: "Keep approving.",
    signals: [
      {
        label: "Waste trend",
        value: "+12%",
        detail: "Produce waste rose after the storm.",
        tone: "brand"
      },
      {
        label: "Supplier late",
        value: "2x",
        detail: "Preferred supplier missed two windows.",
        tone: "brand"
      },
      {
        label: "Friday demand",
        value: "+18%",
        detail: "Friday dinner demand is typically higher.",
        tone: "brand"
      }
    ]
  };

  const memories = createMemoryFromLearningSignals("rest_ascii_c", summary, {
    now: "2026-10-07T12:00:00.000Z"
  });
  assert.equal(memories[0]?.memoryType, "waste_pattern");
  assert.equal(memories[1]?.memoryType, "supplier_reliability");
  assert.equal(memories[2]?.memoryType, "demand_pattern");
});

test("ASCII C fold does not invent Kelvin-sign or NBSP learning-signal identity", () => {
  // Unicode toLowerCase would fold K → k and invent "waste".
  assert.equal(normalizeRestaurantMemoryLearningSignalToken("wastK"), "wastK");
  assert.notEqual(
    normalizeRestaurantMemoryLearningSignalToken("wastK"),
    normalizeRestaurantMemoryLearningSignalToken("waste")
  );

  // NBSP-only padding is outside ASCII whitespace; do not treat it as a trim break.
  assert.equal(
    normalizeRestaurantMemoryLearningSignalToken("\u00a0waste\u00a0"),
    "\u00a0waste\u00a0"
  );
  assert.notEqual(
    normalizeRestaurantMemoryLearningSignalToken("\u00a0waste\u00a0"),
    normalizeRestaurantMemoryLearningSignalToken("waste")
  );

  // Avoid ASCII keywords supplier/waste/approv/prefer/safety/par/buffer/staff/labor/prep
  // in fixture copy so only Kelvin fold could invent a typed memory.
  const invented: LearningMemorySummary = {
    score: 40,
    label: "Learning",
    operatorCopy: "Sparse evidence.",
    nextStep: "Keep observing.",
    signals: [
      {
        label: "WastK lookalike",
        value: "n/a",
        detail: "No ASCII spoilage token present.",
        tone: "brand"
      },
      {
        label: "Kelvin demand",
        value: "n/a",
        detail: "Lookalike must stay a generic demand observation.",
        tone: "brand"
      }
    ]
  };

  const memories = createMemoryFromLearningSignals("rest_ascii_c", invented, {
    now: "2026-10-07T12:00:00.000Z"
  });
  assert.equal(memories[0]?.memoryType, "demand_pattern");
  assert.equal(memories[1]?.memoryType, "demand_pattern");
});
