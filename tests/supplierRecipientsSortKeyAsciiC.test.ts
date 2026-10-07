import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildSupplierRecipientDirectory } from "../services/domain/supplierRecipients";
import type { Supplier, SupplierRecipient } from "../types/mise";

const domainSource = readFileSync(
  new URL("../services/domain/supplierRecipients.ts", import.meta.url),
  "utf8"
);

const restaurantId = "restaurant_a";
const appleSupplierId = "10000000-0000-4000-8000-000000000011";
const kelvinSupplierId = "10000000-0000-4000-8000-000000000012";
const kelvinSignSupplierId = "10000000-0000-4000-8000-000000000013";
const zebraSupplierId = "10000000-0000-4000-8000-000000000014";
const freshSupplierId = "10000000-0000-4000-8000-000000000015";
const freshLowerSupplierId = "10000000-0000-4000-8000-000000000016";

function supplier(
  partial: Partial<Supplier> & Pick<Supplier, "id" | "display_name" | "normalized_name">
): Supplier {
  return {
    restaurant_id: restaurantId,
    created_at: "2026-07-18T10:00:00.000Z",
    updated_at: "2026-07-18T10:00:00.000Z",
    ...partial
  };
}

test("MISE-005JZ pins supplier recipient directory sort key to ASCII C case fold", () => {
  assert.match(domainSource, /MISE-005JZ/);
  assert.match(
    domainSource,
    /function asciiCLower\(value: string\) \{\s*return value\.replace\(\/\[A-Z\]\/g/
  );

  const supplierKeyBody = domainSource.slice(
    domainSource.indexOf("function supplierKey("),
    domainSource.indexOf("function isNewer(")
  );

  assert.match(supplierKeyBody, /return asciiCLower\(value\);/);
  assert.doesNotMatch(supplierKeyBody, /toLocaleLowerCase/);
  assert.doesNotMatch(supplierKeyBody, /\.toLowerCase\(/);
});

test("ASCII C sort key keeps ordinary supplier directory order stable", () => {
  const directory = buildSupplierRecipientDirectory(
    restaurantId,
    [
      supplier({
        id: zebraSupplierId,
        display_name: "Zebra Wholesale",
        normalized_name: "zebra wholesale"
      }),
      supplier({
        id: appleSupplierId,
        display_name: "Apple Farms",
        normalized_name: "apple farms"
      }),
      supplier({
        id: kelvinSupplierId,
        display_name: "Kelvin Produce",
        normalized_name: "kelvin produce"
      })
    ],
    [] as SupplierRecipient[]
  );

  assert.deepEqual(
    directory.map((entry) => entry.supplierName),
    ["Apple Farms", "Kelvin Produce", "Zebra Wholesale"]
  );
});

test("ASCII C sort key does not invent Kelvin-sign directory ordering", () => {
  // Unicode toLocaleLowerCase("en-US") folds K → k and would sort
  // "Kelvin Dairy" with "Kelvin Produce". ASCII C leaves K alone so the
  // lookalike sorts after ordinary ASCII names (U+212A > 'z').
  const directory = buildSupplierRecipientDirectory(
    restaurantId,
    [
      supplier({
        id: zebraSupplierId,
        display_name: "Zebra Wholesale",
        normalized_name: "zebra wholesale"
      }),
      supplier({
        id: kelvinSupplierId,
        display_name: "Kelvin Produce",
        normalized_name: "kelvin produce"
      }),
      supplier({
        id: kelvinSignSupplierId,
        display_name: "Kelvin Dairy",
        normalized_name: "Kelvin dairy"
      }),
      supplier({
        id: appleSupplierId,
        display_name: "Apple Farms",
        normalized_name: "apple farms"
      })
    ],
    [] as SupplierRecipient[]
  );

  assert.deepEqual(
    directory.map((entry) => entry.supplierName),
    ["Apple Farms", "Kelvin Produce", "Zebra Wholesale", "Kelvin Dairy"]
  );
  assert.notEqual(
    directory.findIndex((entry) => entry.supplierId === kelvinSignSupplierId),
    directory.findIndex((entry) => entry.supplierId === kelvinSupplierId) + 1
  );
});

test("ASCII C sort key still folds ordinary ASCII case for directory order", () => {
  const directory = buildSupplierRecipientDirectory(
    restaurantId,
    [
      supplier({
        id: freshLowerSupplierId,
        display_name: "fresh foods",
        normalized_name: "fresh foods"
      }),
      supplier({
        id: freshSupplierId,
        display_name: "Fresh Foods Co",
        normalized_name: "fresh foods co"
      }),
      supplier({
        id: appleSupplierId,
        display_name: "APPLE FARMS",
        normalized_name: "apple farms"
      })
    ],
    [] as SupplierRecipient[]
  );

  assert.deepEqual(
    directory.map((entry) => entry.supplierName),
    ["APPLE FARMS", "fresh foods", "Fresh Foods Co"]
  );
});
