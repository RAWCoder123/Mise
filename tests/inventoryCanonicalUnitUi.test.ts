import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("inventory detail exposes manager canonical-unit verification", () => {
  const source = readFileSync("app/inventory/[id].tsx", "utf8");
  assert.match(source, /verifyInventoryItemCanonicalUnit/);
  assert.match(source, /submitCanonicalVerification/);
  assert.match(source, /inventory\.ops\.verify\.submit/);
  assert.match(source, /suggestCanonicalUnitVerification/);
});

test("inventory application routes verification through the guarded repository RPC", () => {
  const source = readFileSync("services/application/inventory.ts", "utf8");
  assert.match(source, /export async function verifyInventoryItemCanonicalUnit/);
  assert.match(source, /requireCanonicalUnitVerificationInput/);
  assert.match(source, /assertCanonicalUnitMatchesSuggestion/);
  assert.match(source, /repository\.verifyInventoryItemCanonicalUnit/);
});

test("EN ES and ZH catalogs include verification copy", () => {
  const catalog = readFileSync("i18n/catalog.ts", "utf8");
  for (const key of [
    "inventory.ops.verify.body",
    "inventory.ops.verify.submit",
    "inventory.ops.verify.success",
    "inventory.ops.verify.viewOnly"
  ]) {
    const matches = catalog.match(new RegExp(`"${key.replace(/\./g, "\\.")}"`, "g")) ?? [];
    assert.equal(matches.length, 3, `${key} should appear once per locale`);
  }
});
