import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSupplierRecipientDirectory } from "../services/domain/supplierRecipients";
import { canonicalSupplierDisplayName } from "../services/domain/supplierDisplayNameIdentity";
import {
  requireSupplierDisplayName,
  SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS
} from "../services/miseValidation";
import type { Supplier } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/supplierDisplayNameIdentity.ts", import.meta.url),
  "utf8"
);
const validationSource = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);
const recipientsSource = readFileSync(
  new URL("../services/domain/supplierRecipients.ts", import.meta.url),
  "utf8"
);

test("MISE-005JW pins supplier display-name identity to ASCII C", () => {
  assert.match(domainSource, /MISE-005JW/);
  assert.match(domainSource, /C_WHITESPACE = \/\[ \\t\\n\\v\\f\\r\]\+\//);
  assert.match(domainSource, /replace\(\/\\u00a0\/g, " "\)/);

  const canonicalBody = domainSource.slice(
    domainSource.indexOf("export function canonicalSupplierDisplayName(")
  );

  assert.doesNotMatch(canonicalBody, /\.trim\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\.toLocaleLowerCase\(\)/);
  assert.doesNotMatch(canonicalBody, /\\s/);

  assert.match(validationSource, /MISE-005JW/);
  assert.match(
    validationSource,
    /import \{ canonicalSupplierDisplayName \} from "\.\/domain\/supplierDisplayNameIdentity"/
  );
  assert.match(
    validationSource,
    /const displayName = canonicalSupplierDisplayName\(rawName\);/
  );

  const requireBody = validationSource.slice(
    validationSource.indexOf("export function requireSupplierDisplayName("),
    validationSource.indexOf("function requireSupplierDisplaySnapshot(")
  );
  assert.doesNotMatch(requireBody, /\.trim\(\)/);
  assert.doesNotMatch(requireBody, /replace\(\/\\s\+\//);

  assert.match(recipientsSource, /MISE-005JW/);
  assert.match(
    recipientsSource,
    /import \{ canonicalSupplierDisplayName \} from "\.\/supplierDisplayNameIdentity"/
  );
  assert.match(recipientsSource, /return canonicalSupplierDisplayName\(value\);/);
});

test("canonicalSupplierDisplayName folds NBSP and C whitespace without inventing em-space equality", () => {
  assert.equal(
    canonicalSupplierDisplayName("  Fresh\u00a0Foods\tCo  "),
    "Fresh Foods Co"
  );
  assert.equal(
    canonicalSupplierDisplayName("Fresh\u2003Foods"),
    "Fresh\u2003Foods"
  );
  assert.equal(canonicalSupplierDisplayName("Café  Suppliers"), "Café Suppliers");
  assert.notEqual(
    canonicalSupplierDisplayName("Fresh Foods"),
    canonicalSupplierDisplayName("Fresh\u2003Foods")
  );
});

test("requireSupplierDisplayName uses ASCII C prep and rejects controls", () => {
  assert.equal(
    requireSupplierDisplayName("  Legacy\u00a0Bakery  "),
    "Legacy Bakery"
  );
  assert.equal(
    requireSupplierDisplayName("Pantry  Wholesale"),
    "Pantry Wholesale"
  );
  assert.equal(
    requireSupplierDisplayName("Em\u2003Space Supplier"),
    "Em\u2003Space Supplier"
  );

  // TAB is C whitespace for collapse, but remaining control chars in the raw
  // input still fail closed (same control gate as before this tip).
  assert.throws(
    () => requireSupplierDisplayName("Pantry\tWholesale"),
    /Supplier name must be between 1 and 160 characters/
  );
  assert.throws(
    () => requireSupplierDisplayName("   "),
    /Supplier name must be between 1 and 160 characters/
  );
  assert.throws(
    () => requireSupplierDisplayName("Bad\u0000Name"),
    /Supplier name must be between 1 and 160 characters/
  );
  assert.throws(
    () => requireSupplierDisplayName("x".repeat(SUPPLIER_RECIPIENT_NAME_MAX_CHARACTERS + 1)),
    /Supplier name must be between 1 and 160 characters/
  );
});

test("supplier recipient directory presents names under ASCII C display prep", () => {
  const restaurantId = "restaurant_a";
  const supplierId = "10000000-0000-4000-8000-000000000001";
  const suppliers: Supplier[] = [
    {
      id: supplierId,
      restaurant_id: restaurantId,
      display_name: "  Fresh\u00a0Foods  ",
      normalized_name: "fresh foods",
      created_at: "2026-07-18T10:00:00.000Z",
      updated_at: "2026-07-18T10:00:00.000Z"
    }
  ];

  const directory = buildSupplierRecipientDirectory(restaurantId, suppliers, []);
  assert.equal(directory.length, 1);
  assert.equal(directory[0]?.supplierName, "Fresh Foods");
});
