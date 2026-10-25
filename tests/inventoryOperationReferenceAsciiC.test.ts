import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  asciiTrimInventoryOperationReferenceToken,
  canonicalizeInventoryOperationReferenceToken,
  normalizeCanonicalInventoryOperationReasonCode,
  normalizeCanonicalInventoryOperationSourceReference,
  requireCanonicalInventoryOperationReasonCode,
  requireCanonicalInventoryOperationSourceReference
} from "../services/domain/inventoryOperationReferenceIdentity";
import { requireInventoryOperation } from "../services/miseValidation";

const identitySource = readFileSync(
  new URL("../services/domain/inventoryOperationReferenceIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const securityLimitsSource = readFileSync(
  new URL("../services/domain/securityLimits.ts", import.meta.url),
  "utf8"
);

const reference = "invoice-42";
const reason = "delivery";
const accentedReference = "factura-42";
const em = "\u2003";
const nbsp = "\u00a0";

const base = {
  restaurantId: "restaurant-a",
  inventoryItemId: "chicken",
  eventType: "receipt" as const,
  quantity: 1250,
  canonicalUnit: "g" as const,
  effectiveAt: "2026-07-26T10:00:00.000Z"
};

test("MISE-005PU pins inventory-operation reference/reason to ASCII C", () => {
  assert.match(identitySource, /MISE-005PU/);
  assert.match(validationSource, /MISE-005PU/);
  assert.match(
    securityLimitsSource,
    /INVENTORY_OPERATION_SOURCE_REFERENCE_MAX_CHARACTERS = 200/
  );
  assert.match(
    securityLimitsSource,
    /INVENTORY_OPERATION_REASON_CODE_MAX_CHARACTERS = 80/
  );

  assert.match(
    identitySource,
    /export function asciiTrimInventoryOperationReferenceToken\(\s*value: string\s*\) \{\s*return value\.replace\(\/\^\[ \\t\\n\\r\\f\\v\]\+/
  );

  assert.match(
    validationSource,
    /normalizeCanonicalInventoryOperationSourceReference\(\s*input\.sourceReference\s*\)/
  );
  assert.match(
    validationSource,
    /normalizeCanonicalInventoryOperationReasonCode\(input\.reasonCode\)/
  );
  assert.match(
    validationSource,
    /from "\.\/domain\/inventoryOperationReferenceIdentity"/
  );

  const requireInventoryOperationBody = validationSource.slice(
    validationSource.indexOf("export function requireInventoryOperation("),
    validationSource.indexOf("function requireOperatorInventoryEventType(")
  );
  assert.doesNotMatch(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.sourceReference/
  );
  assert.doesNotMatch(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.reasonCode/
  );
  // Sibling note path stays on Unicode trim in this tip (open #854 owns it).
  assert.match(
    requireInventoryOperationBody,
    /optionalBoundedText\(input\.note, "note", 500\)/
  );

  // Do not rewrite sibling tips / modules.
  assert.doesNotMatch(identitySource, /inventoryOperationNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountLineNoteIdentity/);
  assert.doesNotMatch(identitySource, /inventoryCountSessionNoteIdentity/);
  assert.doesNotMatch(identitySource, /supplierOperatorNoteIdentity/);
  assert.doesNotMatch(identitySource, /restaurantMemoryScopeSourceIdentity/);
  assert.doesNotMatch(identitySource, /from "\.\/miseValidation"/);
});

test("ASCII C prep keeps ordinary inventory-operation reference/reason stable", () => {
  assert.equal(
    asciiTrimInventoryOperationReferenceToken(`  ${reference}  `),
    reference
  );
  assert.equal(
    asciiTrimInventoryOperationReferenceToken(`\t${reason}\n`),
    reason
  );
  assert.equal(
    canonicalizeInventoryOperationReferenceToken(`  ${reference}  `),
    reference
  );
  assert.equal(
    normalizeCanonicalInventoryOperationSourceReference(`  ${reference}  `),
    reference
  );
  assert.equal(
    normalizeCanonicalInventoryOperationReasonCode(`  ${reason}  `),
    reason
  );
  assert.equal(
    requireCanonicalInventoryOperationSourceReference(`  ${reference}  `),
    reference
  );
  assert.equal(
    requireCanonicalInventoryOperationReasonCode(`  ${reason}  `),
    reason
  );

  assert.equal(
    normalizeCanonicalInventoryOperationSourceReference(accentedReference),
    accentedReference
  );

  const operation = requireInventoryOperation({
    ...base,
    sourceReference: `  ${reference}  `,
    reasonCode: `  ${reason}  `
  });
  assert.equal(operation.sourceReference, reference);
  assert.equal(operation.reasonCode, reason);
});

test("Unicode em-space / NBSP padding cannot invent clean reference or reason", () => {
  const paddedReference = `${em}${reference}${em}`;
  const paddedReason = `${em}${reason}${em}`;
  const nbspReference = `${nbsp}${reference}${nbsp}`;
  const nbspReason = `${nbsp}${reason}${nbsp}`;

  // Inventing proof: Unicode trim would invent the clean evidence token.
  assert.equal(paddedReference.trim(), reference);
  assert.equal(paddedReason.trim(), reason);
  assert.equal(nbspReference.trim(), reference);
  assert.equal(nbspReason.trim(), reason);

  // ASCII C prep refuses that inventing equality.
  assert.equal(
    asciiTrimInventoryOperationReferenceToken(paddedReference),
    paddedReference
  );
  assert.equal(canonicalizeInventoryOperationReferenceToken(paddedReference), null);
  assert.equal(canonicalizeInventoryOperationReferenceToken(nbspReference), null);
  assert.equal(canonicalizeInventoryOperationReferenceToken(paddedReason), null);
  assert.equal(canonicalizeInventoryOperationReferenceToken(nbspReason), null);

  assert.throws(
    () => normalizeCanonicalInventoryOperationSourceReference(paddedReference),
    /Enter a valid reference\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationReasonCode(paddedReason),
    /Enter a valid reason\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationSourceReference(nbspReference),
    /Enter a valid reference\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationReasonCode(nbspReason),
    /Enter a valid reason\./
  );

  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        sourceReference: paddedReference
      }),
    /Enter a valid reference\./
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        reasonCode: paddedReason
      }),
    /Enter a valid reason\./
  );

  // Internal em-space is not end-padding inventing; keep the operator token.
  const internalEm = `invoice${em}42`;
  assert.equal(
    canonicalizeInventoryOperationReferenceToken(internalEm),
    internalEm
  );
  assert.notEqual(
    canonicalizeInventoryOperationReferenceToken(internalEm),
    reference
  );

  // Kelvin is not folded; case stays presentation-faithful.
  assert.equal(
    canonicalizeInventoryOperationReferenceToken("Kelvin-ref"),
    "Kelvin-ref"
  );
  assert.notEqual(
    canonicalizeInventoryOperationReferenceToken("Kelvin-ref"),
    canonicalizeInventoryOperationReferenceToken("Kelvin-ref")
  );
});

test("inventory-operation reference/reason soft-empty to null; unsafe control/over-long fail closed", () => {
  assert.equal(normalizeCanonicalInventoryOperationSourceReference(undefined), null);
  assert.equal(normalizeCanonicalInventoryOperationSourceReference(null), null);
  assert.equal(normalizeCanonicalInventoryOperationSourceReference(""), null);
  assert.equal(normalizeCanonicalInventoryOperationSourceReference("   "), null);
  assert.equal(normalizeCanonicalInventoryOperationSourceReference(`${em}${em}`), null);
  assert.equal(normalizeCanonicalInventoryOperationReasonCode(undefined), null);
  assert.equal(normalizeCanonicalInventoryOperationReasonCode(`${nbsp}`), null);

  const omitted = requireInventoryOperation({ ...base });
  assert.equal(omitted.sourceReference, null);
  assert.equal(omitted.reasonCode, null);

  const softEmpty = requireInventoryOperation({
    ...base,
    sourceReference: `${em}${em}`,
    reasonCode: "   "
  });
  assert.equal(softEmpty.sourceReference, null);
  assert.equal(softEmpty.reasonCode, null);

  assert.throws(
    () => requireCanonicalInventoryOperationSourceReference(`${em}${em}`),
    /Enter a valid reference\./
  );
  assert.throws(
    () => requireCanonicalInventoryOperationReasonCode("   "),
    /Enter a valid reason\./
  );

  assert.throws(
    () => normalizeCanonicalInventoryOperationSourceReference("x".repeat(201)),
    /Enter a shorter reference\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationReasonCode("x".repeat(81)),
    /Enter a shorter reason\./
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        sourceReference: "x".repeat(201)
      }),
    /shorter reference/
  );
  assert.throws(
    () =>
      requireInventoryOperation({
        ...base,
        reasonCode: "x".repeat(81)
      }),
    /shorter reason/
  );

  assert.throws(
    () => normalizeCanonicalInventoryOperationSourceReference("bad\u0000ref"),
    /Enter a valid reference\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationReasonCode("bad\u0007reason"),
    /Enter a valid reason\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationSourceReference(42),
    /Enter a valid reference\./
  );
  assert.throws(
    () => normalizeCanonicalInventoryOperationReasonCode(false),
    /Enter a valid reason\./
  );

  // Sibling note path still Unicode-trims on main in this tip.
  assert.deepEqual(
    requireInventoryOperation({
      ...base,
      note: " Chilled on arrival "
    }).metadata,
    { note: "Chilled on arrival" }
  );
});
