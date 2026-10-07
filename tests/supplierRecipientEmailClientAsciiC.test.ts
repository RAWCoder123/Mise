import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { requireSupplierRecipientInput } from "../services/miseValidation";

const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant_a";
const supplierId = "10000000-0000-4000-8000-000000000001";

test("MISE-005JL pins requireSupplierRecipientInput email to ASCII C case fold", () => {
  assert.match(validationSource, /MISE-005JL/);
  assert.match(
    validationSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const requireBody = validationSource.slice(
    validationSource.indexOf("export function requireSupplierRecipientInput("),
    validationSource.indexOf("function hasControlCharacters(")
  );

  assert.match(requireBody, /asciiCTrim\(asciiCLower\(input\.email\)\)/);
  assert.match(requireBody, /asciiCMailboxShape\.test\(email\)/);
  assert.doesNotMatch(requireBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(requireBody, /input\.email\.trim\(\)/);
  assert.doesNotMatch(requireBody, /\\s/);
});

test("MISE-005JL pins supplier-send preview email shape to ASCII C mailbox class", () => {
  const previewBody = validationSource.slice(
    validationSource.indexOf("function requireNullableSupplierSendEmail("),
    validationSource.indexOf("function requireSupplierSendBody(")
  );

  assert.match(previewBody, /asciiCLower\(email\)/);
  assert.match(previewBody, /asciiCMailboxShape\.test\(email\)/);
  assert.doesNotMatch(previewBody, /email\.toLowerCase\(\)/);
  assert.doesNotMatch(previewBody, /\\s/);
});

test("ASCII C fold keeps ordinary supplier-recipient mailboxes stable", () => {
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "  Orders@Fresh.Example  "
    }),
    {
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@fresh.example"
    }
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "not-an-email"
      }),
    /valid supplier email/i
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "a@b"
      }),
    /valid supplier email/i
  );
});

test("ASCII C fold does not invent Kelvin-sign mailbox identity", () => {
  // Unicode toLowerCase would fold K → k and invent orders@fresh.example.
  assert.equal(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "Krders@Fresh.Example"
    }).email,
    "Krders@fresh.example"
  );
  assert.notEqual(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "Krders@Fresh.Example"
    }).email,
    "krders@fresh.example"
  );

  assert.equal(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@Kresh.example"
    }).email,
    "orders@Kresh.example"
  );
  assert.notEqual(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@Kresh.example"
    }).email,
    "orders@kresh.example"
  );
});

test("ASCII C mailbox shape rejects controls; NBSP is not ASCII space", () => {
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders@exam\nple.com"
      }),
    /valid supplier email/i
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders@exam\x01ple.com"
      }),
    /valid supplier email/i
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders@exam\x7fple.com"
      }),
    /valid supplier email/i
  );
  // NBSP is outside C-locale [[:space:]]; preserve it rather than treating it
  // as a Unicode `\s` break the way the pre-pin client did.
  assert.equal(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@exam\u00a0ple.com"
    }).email,
    "orders@exam\u00a0ple.com"
  );
});
