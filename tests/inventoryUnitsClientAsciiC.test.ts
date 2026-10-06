import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalInventoryUnit,
  inventoryUnitsAreCompatible
} from "../services/domain/inventoryUnits";

const domainSource = readFileSync(
  new URL("../services/domain/inventoryUnits.ts", import.meta.url),
  "utf8"
);

test("MISE-005JA pins client inventory unit helpers to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JA/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const canonicalBody = domainSource.slice(
    domainSource.indexOf("export function canonicalInventoryUnit"),
    domainSource.indexOf("export function inventoryUnitsAreCompatible")
  );

  assert.match(canonicalBody, /asciiCNormalizeUnitToken\(value\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s\+/);
});

test("canonicalInventoryUnit folds ASCII case like COLLATE C", () => {
  assert.equal(canonicalInventoryUnit("LB"), "lb");
  assert.equal(canonicalInventoryUnit("  pounds  "), "lb");
  assert.equal(canonicalInventoryUnit("Kg"), "kg");
  assert.equal(canonicalInventoryUnit("UNITS"), "each");
  assert.equal(canonicalInventoryUnit(null), "");
  assert.equal(canonicalInventoryUnit(undefined), "");
  assert.equal(canonicalInventoryUnit(""), "");
  // Non-ASCII letters are not folded by COLLATE C / asciiCLower.
  // Unicode toLowerCase would map Kelvin sign K → k and invent "kg".
  assert.equal(canonicalInventoryUnit("KG"), "Kg");
  assert.notEqual(canonicalInventoryUnit("KG"), "kg");
});

test("inventoryUnitsAreCompatible stays exact under ASCII C fold", () => {
  assert.equal(inventoryUnitsAreCompatible(" LB ", "pounds"), true);
  assert.equal(inventoryUnitsAreCompatible("units", "ea"), true);
  assert.equal(inventoryUnitsAreCompatible("lb", "oz"), false);
  // Kelvin-sign "mass" must not falsely match ASCII kg after Unicode fold.
  assert.equal(inventoryUnitsAreCompatible("KG", "kg"), false);
  assert.equal(inventoryUnitsAreCompatible("KG", "kilograms"), true);
});
