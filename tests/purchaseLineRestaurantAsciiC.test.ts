import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimPurchaseLineRestaurantToken,
  canonicalizePurchaseLineRestaurantId,
  requireCanonicalPurchaseLineRestaurantId
} from "../services/domain/purchaseLineRestaurantIdentity";

const identitySource = readFileSync(
  new URL("../services/domain/purchaseLineRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const applicationSource = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";

test("MISE-005KY pins purchase-line restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005KY/);
  assert.match(applicationSource, /MISE-005KY/);

  assert.match(
    identitySource,
    /export function asciiTrimPurchaseLineRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    applicationSource,
    /requireCanonicalPurchaseLineRestaurantId\(restaurantId\)/
  );
  assert.doesNotMatch(applicationSource, /restaurantId\.trim\(\)/);
  assert.doesNotMatch(applicationSource, /input\.restaurantId\.trim\(\)/);

  // Leave sibling tips alone.
  assert.doesNotMatch(identitySource, /supplierRecipientRestaurantIdentity/);
  assert.doesNotMatch(identitySource, /hostedUuidIdentity/);
  assert.doesNotMatch(identitySource, /supplierAuthorityIdentity/);
  // Do not retarget source-document or line-id trim on this tip.
  assert.match(applicationSource, /sourceDocumentReference\.trim\(\)/);
  assert.match(applicationSource, /lineId\.trim\(\)/);
});

test("ASCII trim keeps ordinary purchase-line restaurant workspace padding stable", () => {
  assert.equal(asciiTrimPurchaseLineRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizePurchaseLineRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalPurchaseLineRestaurantId(` ${workspace} `), workspace);
});

test("ASCII purchase-line restaurant trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimPurchaseLineRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizePurchaseLineRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalPurchaseLineRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizePurchaseLineRestaurantId(emSpacePadded), null);
  assert.throws(
    () => requireCanonicalPurchaseLineRestaurantId(emSpacePadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("purchase-line restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizePurchaseLineRestaurantId(""), null);
  assert.equal(canonicalizePurchaseLineRestaurantId("   "), null);
  assert.equal(canonicalizePurchaseLineRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizePurchaseLineRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalPurchaseLineRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalPurchaseLineRestaurantId(""),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () => requireCanonicalPurchaseLineRestaurantId("bad\u0000id"),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});
