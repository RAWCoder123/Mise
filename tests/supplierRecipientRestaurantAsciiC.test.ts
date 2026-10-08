import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierRecipientRestaurantToken,
  canonicalizeSupplierRecipientRestaurantId,
  requireCanonicalSupplierRecipientRestaurantId
} from "../services/domain/supplierRecipientRestaurantIdentity";
import { requireSupplierRecipientInput } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/supplierRecipientRestaurantIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const workspace = "restaurant_a";
const supplierId = "10000000-0000-4000-8000-000000000001";
const email = "orders@fresh.test";

test("MISE-005KX pins requireSupplierRecipientInput restaurant_id to ASCII C", () => {
  assert.match(identitySource, /MISE-005KX/);
  assert.match(validationSource, /MISE-005KX/);

  assert.match(
    identitySource,
    /export function asciiTrimSupplierRecipientRestaurantToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  const requireBody = validationSource.slice(
    validationSource.indexOf(
      "export function requireSupplierRecipientInput(input: {"
    ),
    validationSource.indexOf("function hasControlCharacters(value: string)")
  );
  assert.match(requireBody, /requireCanonicalSupplierRecipientRestaurantId\(input\.restaurant_id\)/);
  assert.doesNotMatch(requireBody, /restaurant_id\.trim\(\)/);
  assert.doesNotMatch(requireBody, /input\.restaurant_id\.trim\(\)/);

  // Leave email (#681) and supplier-authority UUID (#726) tips alone.
  assert.doesNotMatch(identitySource, /asciiCMailboxShape/);
  assert.doesNotMatch(identitySource, /supplierAuthorityIdentity/);
  assert.doesNotMatch(identitySource, /hostedUuidIdentity/);
});

test("ASCII trim keeps ordinary restaurant workspace padding stable", () => {
  assert.equal(asciiTrimSupplierRecipientRestaurantToken(`  ${workspace}  `), workspace);
  assert.equal(canonicalizeSupplierRecipientRestaurantId(`\t${workspace}\n`), workspace);
  assert.equal(requireCanonicalSupplierRecipientRestaurantId(` ${workspace} `), workspace);
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: ` ${workspace} `,
      supplier_id: ` ${supplierId} `,
      email: ` ${email.toUpperCase()} `
    }),
    {
      restaurant_id: workspace,
      supplier_id: supplierId,
      email: email
    }
  );
});

test("ASCII restaurant workspace trim ignores NBSP; Unicode trim would invent identity", () => {
  const nbspPadded = `\u00a0${workspace}\u00a0`;
  // Unicode trim invents an exact match against the unpadded workspace.
  assert.equal(nbspPadded.trim(), workspace);
  assert.notEqual(asciiTrimSupplierRecipientRestaurantToken(nbspPadded), workspace);
  assert.equal(canonicalizeSupplierRecipientRestaurantId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierRecipientRestaurantId(nbspPadded),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: nbspPadded,
        supplier_id: supplierId,
        email
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );

  const emSpacePadded = `\u2003${workspace}\u2003`;
  assert.equal(emSpacePadded.trim(), workspace);
  assert.equal(canonicalizeSupplierRecipientRestaurantId(emSpacePadded), null);
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: emSpacePadded,
        supplier_id: supplierId,
        email
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
});

test("supplier-recipient restaurant workspace rejects empty and control-bearing tokens", () => {
  assert.equal(canonicalizeSupplierRecipientRestaurantId(""), null);
  assert.equal(canonicalizeSupplierRecipientRestaurantId("   "), null);
  assert.equal(canonicalizeSupplierRecipientRestaurantId("a".repeat(129)), null);
  assert.equal(canonicalizeSupplierRecipientRestaurantId("bad\u0000id"), null);
  assert.throws(
    () => requireCanonicalSupplierRecipientRestaurantId(null),
    (error: unknown) =>
      error instanceof Error && error.message === "Missing restaurant workspace."
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: "",
        supplier_id: supplierId,
        email
      }),
    /restaurant workspace/i
  );
});
