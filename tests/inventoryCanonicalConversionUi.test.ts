import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory detail surfaces verified purchase-to-canonical conversion factor", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /resolveVerifiedCanonicalConversion/);
  assert.match(source, /inventory\.ops\.canonicalConversion/);
  assert.match(source, /verifiedConversion\.quantityPerUnit/);
  assert.match(source, /maximumFractionDigits:\s*6/);
  // Fail closed: keep unit-letter fallback when factor is absent.
  assert.match(source, /inventory\.ops\.canonicalUnit/);
});

test("EN ES and ZH catalogs include verified conversion copy", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  const matches =
    catalog.match(/"inventory\.ops\.canonicalConversion"/g) ?? [];
  assert.equal(matches.length, 3, "canonicalConversion should appear once per locale");
  assert.match(
    catalog,
    /"inventory\.ops\.canonicalConversion": "Verified conversion: 1 \{purchaseUnit\} = \{quantity\} \{unit\}"/
  );
  assert.match(
    catalog,
    /"inventory\.ops\.canonicalConversion": "Conversión verificada: 1 \{purchaseUnit\} = \{quantity\} \{unit\}"/
  );
  assert.match(
    catalog,
    /"inventory\.ops\.canonicalConversion": "已验证换算：1 \{purchaseUnit\} = \{quantity\} \{unit\}"/
  );
});
