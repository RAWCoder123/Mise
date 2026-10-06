import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseSetupPosSalesCsv } from "../services/domain/setupDrafts";

const domainSource = readFileSync(
  new URL("../services/domain/setupDrafts.ts", import.meta.url),
  "utf8"
);

test("MISE-005JG pins setupDrafts header and fingerprint normalize to ASCII C", () => {
  assert.match(domainSource, /MISE-005JG/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const normalizeHeaderBody = domainSource.slice(
    domainSource.indexOf("function normalizeHeader("),
    domainSource.indexOf("function splitCsvLine(")
  );
  assert.match(normalizeHeaderBody, /asciiCNormalizeToken\(value\)/);
  assert.doesNotMatch(normalizeHeaderBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(normalizeHeaderBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(normalizeHeaderBody, /\.trim\(\)/);

  assert.match(domainSource, /asciiCNormalizeToken\(itemName\)/);
  assert.match(domainSource, /asciiCNormalizeToken\(category\)/);
  assert.doesNotMatch(
    domainSource,
    /itemName\.trim\(\)\.toLowerCase\(\)/
  );
  assert.doesNotMatch(
    domainSource,
    /category\.trim\(\)\.toLowerCase\(\)/
  );
});

test("CSV headers fold ASCII case without inventing Kelvin aliases", () => {
  const ascii = parseSetupPosSalesCsv(
    [
      "SALE_DATE,ITEM_NAME,CATEGORY,QUANTITY_SOLD,GROSS_SALES",
      "2026-10-06,Chicken Bowl,Entrees,2,24"
    ].join("\n")
  );
  assert.equal(ascii.status, "ready");
  assert.equal(ascii.acceptedRowCount, 1);
  assert.equal(ascii.rows[0]?.itemName, "Chicken Bowl");

  // Unicode toLowerCase would fold K → k and invent item_name / sale_date aliases.
  const kelvin = parseSetupPosSalesCsv(
    [
      "KALE_DATE,KTEM_NAME,CATEGORY,QUANTITY_SOLD,GROSS_SALES",
      "2026-10-06,Chicken Bowl,Entrees,2,24"
    ].join("\n")
  );
  assert.equal(kelvin.acceptedRowCount, 0);
  assert.ok(
    kelvin.issues.some(
      (issue) => issue.field === "sale_date" || issue.field === "item_name"
    )
  );
});

test("POS import fingerprints keep Kelvin item names distinct under ASCII C", () => {
  const result = parseSetupPosSalesCsv(
    [
      "sale_date,item_name,category,quantity_sold,gross_sales",
      "2026-10-06,Chicken Bowl,Entrees,2,24",
      "2026-10-06,Khicken Bowl,Entrees,2,24",
      "2026-10-06,CHICKEN BOWL,Entrees,2,24"
    ].join("\n")
  );

  assert.equal(result.status, "ready");
  assert.equal(result.acceptedRowCount, 3);
  const ids = result.rows.map((row) => row.id);
  assert.equal(ids.length, 3);
  const asciiId = ids[0]!;
  const kelvinId = ids[1]!;
  const upperId = ids[2]!;
  // ASCII case fold collapses CHICKEN/Chicken into one fingerprint family with
  // occurrence suffixes, while Kelvin stays on a different fingerprint.
  assert.notEqual(asciiId, kelvinId);

  const fingerprintOf = (id: string) => id.replace(/^pos_import_/, "").replace(/_\d+$/, "");
  assert.equal(fingerprintOf(asciiId), fingerprintOf(upperId));
  assert.notEqual(fingerprintOf(asciiId), fingerprintOf(kelvinId));
});
