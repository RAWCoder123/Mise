import assert from "node:assert/strict";
import test from "node:test";

import { resolveVerifiedCanonicalConversion } from "../services/presentation/inventoryCanonicalConversionPresentation";
import type { InventoryItem } from "../types/mise";

function item(
  overrides: Partial<InventoryItem> = {}
): Pick<
  InventoryItem,
  | "unit"
  | "canonical_unit"
  | "canonical_quantity_per_unit"
  | "canonical_unit_verification_status"
> {
  return {
    unit: "lbs",
    canonical_unit: "g",
    canonical_quantity_per_unit: 453.59237,
    canonical_unit_verification_status: "verified",
    ...overrides
  };
}

test("resolveVerifiedCanonicalConversion returns verified purchase-to-canonical factor", () => {
  assert.deepEqual(resolveVerifiedCanonicalConversion(item()), {
    canonicalUnit: "g",
    purchaseUnit: "lbs",
    quantityPerUnit: 453.59237
  });
});

test("resolveVerifiedCanonicalConversion fails closed without verified status", () => {
  assert.equal(
    resolveVerifiedCanonicalConversion(
      item({ canonical_unit_verification_status: "draft" })
    ),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(
      item({ canonical_unit_verification_status: "rejected" })
    ),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(
      item({ canonical_unit_verification_status: "expired" })
    ),
    null
  );
});

test("resolveVerifiedCanonicalConversion fails closed on missing or invalid factors", () => {
  assert.equal(
    resolveVerifiedCanonicalConversion(item({ canonical_quantity_per_unit: null })),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(item({ canonical_quantity_per_unit: 0 })),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(item({ canonical_quantity_per_unit: -1 })),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(
      item({ canonical_quantity_per_unit: Number.NaN })
    ),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(
      item({ canonical_quantity_per_unit: Number.POSITIVE_INFINITY })
    ),
    null
  );
  assert.equal(
    resolveVerifiedCanonicalConversion(item({ canonical_unit: null })),
    null
  );
  assert.equal(resolveVerifiedCanonicalConversion(item({ unit: "   " })), null);
  assert.equal(resolveVerifiedCanonicalConversion(null), null);
});

test("resolveVerifiedCanonicalConversion trims purchase unit labels", () => {
  assert.deepEqual(resolveVerifiedCanonicalConversion(item({ unit: "  case  " })), {
    canonicalUnit: "g",
    purchaseUnit: "case",
    quantityPerUnit: 453.59237
  });
});
