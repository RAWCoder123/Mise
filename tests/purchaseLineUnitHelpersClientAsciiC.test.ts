import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  computePurchaseLineConsistencyFlags,
  purchaseLinePackUnit,
  purchaseLineUnitDimension
} from "../services/domain/purchaseLines";

const domainSource = readFileSync(
  new URL("../services/domain/purchaseLines.ts", import.meta.url),
  "utf8"
);

test("MISE-005IZ pins client unit helpers to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005IZ/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const dimensionBody = domainSource.slice(
    domainSource.indexOf("export function purchaseLineUnitDimension"),
    domainSource.indexOf("export function purchaseLinePackUnit")
  );
  const packBody = domainSource.slice(
    domainSource.indexOf("export function purchaseLinePackUnit"),
    domainSource.indexOf("function packUnit")
  );

  assert.match(dimensionBody, /asciiCLower\(unit\)/);
  assert.match(packBody, /asciiCLower\(packSize\)/);
  assert.doesNotMatch(dimensionBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(packBody, /\.toLowerCase\(\)/);
  // Trailing extract stays ASCII [a-z], matching SQL regexp_match(..., '([a-z]+)$').
  assert.match(packBody, /\/\(\[a-z\]\+\)\$\//);
  assert.doesNotMatch(packBody, /\/\(\[a-z\]\+\)\$\/u/);
});

test("purchaseLineUnitDimension folds ASCII case like COLLATE C", () => {
  assert.equal(purchaseLineUnitDimension("GAL"), "volume");
  assert.equal(purchaseLineUnitDimension("  LB  "), "mass");
  assert.equal(purchaseLineUnitDimension("Kg"), "mass");
  assert.equal(purchaseLineUnitDimension("ml"), "volume");
  assert.equal(purchaseLineUnitDimension(null), null);
  assert.equal(purchaseLineUnitDimension(""), null);
  // Non-ASCII letters are not folded by COLLATE C / asciiCLower.
  assert.equal(purchaseLineUnitDimension("KG"), null);
});

test("purchaseLinePackUnit extracts trailing ASCII unit under C fold", () => {
  assert.equal(purchaseLinePackUnit("6/1GAL"), "gal");
  assert.equal(purchaseLinePackUnit("12 x 32 OZ"), "oz");
  assert.equal(purchaseLinePackUnit("5 LB"), "lb");
  assert.equal(purchaseLinePackUnit(null), null);
  assert.equal(purchaseLinePackUnit("12"), null);
  assert.equal(purchaseLinePackUnit("no-unit"), "unit");
});

test("pack_unit_dimension_conflict still fires when dimensions disagree", () => {
  const flags = computePurchaseLineConsistencyFlags({
    quantity: 1,
    unitOfMeasure: "LB",
    packSize: "6/1GAL",
    unitPrice: 10,
    extendedPrice: 10,
    transactionDate: "2026-09-01",
    receivedDate: null,
    statedPackSize: null,
    describedPackSize: null
  });
  assert.deepEqual(flags, ["pack_unit_dimension_conflict"]);
});
