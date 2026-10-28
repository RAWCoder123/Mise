import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimSupplierSendPreviewExpectedToken,
  canonicalizeSupplierSendPreviewExpectedId,
  requireCanonicalSupplierSendPreviewExpectedId
} from "../services/domain/supplierSendPreviewExpectedIdentity";
import { normalizeSupplierSendContentPreview } from "../services/miseValidation";
import { SUPPLIER_SEND_CONTENT_VERSION } from "../types/mise";

const identitySource = readFileSync(
  new URL("../services/domain/supplierSendPreviewExpectedIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const restaurantId = "10000000-0000-4000-8000-000000000001";
const orderId = "20000000-0000-4000-8000-000000000001";
const supplierId = "50000000-0000-4000-8000-000000000001";
const fingerprint = "a".repeat(64);

function readyPreview() {
  return {
    ready: true,
    blockerCodes: [] as string[],
    lineCount: 1,
    contentVersion: SUPPLIER_SEND_CONTENT_VERSION,
    contentFingerprint: fingerprint,
    contentRevision: 7,
    restaurantId,
    orderId,
    supplierId,
    supplierName: "Local Produce Co.",
    from: "orders@example.com",
    to: "produce@example.com",
    subject: "Mise Cafe order for Local Produce Co.",
    body: "Order draft for Local Produce Co.\n\nTomatoes - 4 each",
    deliveryDate: "2026-08-24",
    operatorNote: null as string | null,
    lines: [
      {
        recommendationId: "30000000-0000-4000-8000-000000000001",
        inventoryItemId: "40000000-0000-4000-8000-000000000001",
        supplierId,
        itemName: "Tomatoes",
        quantity: 4,
        unit: "each",
        supplierName: "Local Produce Co."
      }
    ]
  };
}

test("MISE-005SN pins supplier-send preview expected identities to ASCII C", () => {
  assert.match(identitySource, /MISE-005SN/);
  assert.match(validationSource, /MISE-005SN/);
  assert.match(
    validationSource,
    /from "\.\/domain\/supplierSendPreviewExpectedIdentity"/
  );
  assert.match(
    validationSource,
    /canonicalizeSupplierSendPreviewExpectedId\(expected\) \?\? ""/
  );
  assert.match(
    identitySource,
    /export function asciiTrimSupplierSendPreviewExpectedToken\(value: string\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  // Leave payload value matching, text/email/body parsers, and fingerprint alone.
  assert.match(
    validationSource,
    /value !== normalizedExpected \|\|\s*value\.length > 128 \|\|\s*hasControlCharacters\(value\)/
  );
  assert.doesNotMatch(identitySource, /supplierSendSubjectIdentity/);
  assert.doesNotMatch(identitySource, /normalizedEmail/);
  assert.doesNotMatch(
    validationSource,
    /requireCanonicalSupplierSendPreviewExpectedId\(expected/
  );
});

test("ASCII C expected prep rejects Unicode padding that Unicode trim invented", () => {
  const emPadded = `\u2003${restaurantId}\u2003`;
  const nbspPadded = `\u00a0${restaurantId}\u00a0`;

  // Inventing proof against the prior Unicode trim sink.
  assert.equal(emPadded.trim(), restaurantId);
  assert.equal(nbspPadded.trim(), restaurantId);

  assert.equal(asciiTrimSupplierSendPreviewExpectedToken(emPadded), emPadded);
  assert.equal(canonicalizeSupplierSendPreviewExpectedId(emPadded), null);
  assert.equal(canonicalizeSupplierSendPreviewExpectedId(nbspPadded), null);
  assert.throws(
    () => requireCanonicalSupplierSendPreviewExpectedId(emPadded, "restaurant"),
    /invalid restaurant identity/
  );

  // ASCII whitespace still end-trims cleanly.
  assert.equal(
    canonicalizeSupplierSendPreviewExpectedId(`  ${restaurantId}  `),
    restaurantId
  );
  assert.equal(
    requireCanonicalSupplierSendPreviewExpectedId(`\t${orderId}\n`, "order"),
    orderId
  );

  // Soft empty / Unicode-only spaces fail closed.
  assert.equal(canonicalizeSupplierSendPreviewExpectedId("   "), null);
  assert.equal(canonicalizeSupplierSendPreviewExpectedId("\u2003\u2003"), null);
  assert.equal(canonicalizeSupplierSendPreviewExpectedId("x".repeat(129)), null);
});

test("preview scope match fails closed on Unicode-padded expected restaurant id", () => {
  const preview = readyPreview();
  assert.throws(
    () =>
      normalizeSupplierSendContentPreview(
        preview,
        `\u2003${restaurantId}\u2003`,
        orderId
      ),
    /invalid restaurant identity/
  );
});

test("preview scope match fails closed on Unicode-padded expected order id", () => {
  const preview = readyPreview();
  assert.throws(
    () =>
      normalizeSupplierSendContentPreview(
        preview,
        restaurantId,
        `\u00a0${orderId}\u00a0`
      ),
    /invalid order identity/
  );
});

test("preview still accepts ASCII-padded expected identities that match payload", () => {
  const preview = readyPreview();
  const direct = normalizeSupplierSendContentPreview(
    preview,
    `  ${restaurantId}  `,
    `\t${orderId}\n`
  );
  assert.equal(direct.restaurantId, restaurantId);
  assert.equal(direct.orderId, orderId);
  assert.equal(direct.contentFingerprint, fingerprint);
});
