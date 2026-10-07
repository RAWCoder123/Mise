import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEMO_DATASET,
  isDemoDatasetRestaurantName,
  normalizeDemoDatasetRestaurantName
} from "../services/demo/demoDataset";

const datasetSource = readFileSync(
  new URL("../services/demo/demoDataset.ts", import.meta.url),
  "utf8"
);
const replaceableSource = readFileSync(
  new URL("../services/demo/replaceableDemoData.ts", import.meta.url),
  "utf8"
);

test("MISE-005JP pins demoDataset restaurant-name identity normalize to ASCII C case fold", () => {
  assert.match(datasetSource, /MISE-005JP/);
  assert.match(
    datasetSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeBody = datasetSource.slice(
    datasetSource.indexOf("export function normalizeDemoDatasetRestaurantName("),
    datasetSource.indexOf("export function isDemoDatasetRestaurantName(")
  );
  assert.match(normalizeBody, /asciiCLower\(asciiCTrim\(value\)\)/);
  assert.doesNotMatch(normalizeBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeBody, /\.trim\(\)/);
  assert.doesNotMatch(normalizeBody, /\\s/);

  const predicateBody = datasetSource.slice(
    datasetSource.indexOf("export function isDemoDatasetRestaurantName(")
  );
  assert.match(predicateBody, /normalizeDemoDatasetRestaurantName\(value\)/);
  assert.match(
    predicateBody,
    /normalizeDemoDatasetRestaurantName\(DEMO_DATASET\.restaurant\.name\)/
  );
  assert.doesNotMatch(predicateBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(predicateBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(predicateBody, /\.trim\(\)/);

  assert.match(replaceableSource, /isDemoDatasetRestaurantName\(/);
  assert.match(
    replaceableSource,
    /referenceRestaurantNameMatches = isDemoDatasetRestaurantName\(\s*raw\.restaurants\?\.\[0\]\?\.name/
  );
  assert.doesNotMatch(
    replaceableSource,
    /restaurants\?\.\[0\]\?\.name\?\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    replaceableSource,
    /DEMO_DATASET\.restaurant\.name\.toLowerCase\(\)/
  );
});

test("ASCII C fold keeps ordinary demo restaurant names stable", () => {
  assert.equal(normalizeDemoDatasetRestaurantName("  Demo Restaurant  "), "demo restaurant");
  assert.equal(normalizeDemoDatasetRestaurantName("DEMO RESTAURANT"), "demo restaurant");
  assert.equal(
    normalizeDemoDatasetRestaurantName("Demo Restaurant"),
    normalizeDemoDatasetRestaurantName(DEMO_DATASET.restaurant.name)
  );
  assert.equal(isDemoDatasetRestaurantName("Demo Restaurant"), true);
  assert.equal(isDemoDatasetRestaurantName("  DEMO RESTAURANT  "), true);
  assert.equal(isDemoDatasetRestaurantName("Other Restaurant"), false);
  assert.equal(isDemoDatasetRestaurantName(null), false);
  assert.equal(isDemoDatasetRestaurantName(undefined), false);
  assert.equal(isDemoDatasetRestaurantName(""), false);
});

test("ASCII C fold does not invent Kelvin-sign demo restaurant identity", () => {
  // Unicode toLowerCase would fold K → k and invent "demo restaurant".
  assert.equal(normalizeDemoDatasetRestaurantName("Kemo Restaurant"), "Kemo restaurant");
  assert.notEqual(
    normalizeDemoDatasetRestaurantName("Kemo Restaurant"),
    normalizeDemoDatasetRestaurantName(DEMO_DATASET.restaurant.name)
  );
  assert.equal(isDemoDatasetRestaurantName("Kemo Restaurant"), false);

  // NBSP is outside ASCII whitespace; do not treat it as a Unicode `\s` break.
  assert.equal(
    normalizeDemoDatasetRestaurantName("Demo\u00a0Restaurant"),
    "demo\u00a0restaurant"
  );
  assert.notEqual(
    normalizeDemoDatasetRestaurantName("Demo\u00a0Restaurant"),
    normalizeDemoDatasetRestaurantName(DEMO_DATASET.restaurant.name)
  );
  assert.equal(isDemoDatasetRestaurantName("Demo\u00a0Restaurant"), false);
});
