import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineConsistencyFlagsEvidence } from "../services/domain/purchaseLineConsistencyFlagsEvidence";
import {
  computePurchaseLineConsistencyFlags,
  normalizePurchaseLineDescription,
  normalizePurchaseLineInput
} from "../services/domain/purchaseLines";

const migrationPath =
  "supabase/migrations/20261126150000_purchase_line_consistency_flags_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_consistency_flags_evidence.test.sql",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");
const evidence = readFileSync(
  "services/domain/purchaseLineConsistencyFlagsEvidence.ts",
  "utf8"
);

function expectedStoredFlags(input: {
  quantity: number | null;
  unitOfMeasure: string | null;
  packSize: string | null;
  unitPrice: number | null;
  extendedPrice: number | null;
  transactionDate: string;
  receivedDate: string | null;
  rawItemDescription: string;
}) {
  return computePurchaseLineConsistencyFlags({
    quantity: input.quantity,
    unitOfMeasure: input.unitOfMeasure,
    packSize: input.packSize,
    unitPrice: input.unitPrice,
    extendedPrice: input.extendedPrice,
    transactionDate: input.transactionDate,
    receivedDate: input.receivedDate,
    statedPackSize: input.packSize,
    describedPackSize: normalizePurchaseLineDescription(input.rawItemDescription).packSize
  });
}

test("validatePurchaseLineConsistencyFlagsEvidence rejects forged empty flags", () => {
  const rawItemDescription = "Onions 5 lb";
  const packSize = normalizePurchaseLineDescription(rawItemDescription).packSize;
  const expected = expectedStoredFlags({
    quantity: 10,
    unitOfMeasure: "lb",
    packSize,
    unitPrice: 1,
    extendedPrice: 50,
    transactionDate: "2026-11-26",
    receivedDate: null,
    rawItemDescription
  });
  assert.deepEqual(expected, ["extended_price_mismatch"]);

  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: [],
      expectedConsistencyFlags: expected
    }),
    "invalid_consistency_flags"
  );

  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: expected,
      expectedConsistencyFlags: expected
    }),
    null
  );
});

test("validatePurchaseLineConsistencyFlagsEvidence rejects invented downgrade flags", () => {
  const expected = expectedStoredFlags({
    quantity: 2,
    unitOfMeasure: "lb",
    packSize: null,
    unitPrice: 3,
    extendedPrice: 6,
    transactionDate: "2026-11-26",
    receivedDate: "2026-11-27",
    rawItemDescription: "Onions"
  });
  assert.deepEqual(expected, []);

  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: ["received_before_transaction"],
      expectedConsistencyFlags: expected
    }),
    "invalid_consistency_flags"
  );

  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: [],
      expectedConsistencyFlags: expected
    }),
    null
  );
});

test("normalizePurchaseLineInput keeps flags that match durable stored-shape reconstruction", () => {
  const mismatched = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Butter 5 lb",
    quantity: 4,
    unitOfMeasure: "lb",
    unitPrice: 2,
    extendedPrice: 20,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(mismatched.consistencyFlags, ["extended_price_mismatch"]);
  assert.equal(mismatched.parseConfidence, "could_not_verify");
  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: mismatched.consistencyFlags,
      expectedConsistencyFlags: expectedStoredFlags({
        quantity: mismatched.quantity,
        unitOfMeasure: mismatched.unitOfMeasure,
        packSize: mismatched.packSize,
        unitPrice: mismatched.unitPrice,
        extendedPrice: mismatched.extendedPrice,
        transactionDate: mismatched.transactionDate,
        receivedDate: mismatched.receivedDate,
        rawItemDescription: mismatched.rawItemDescription
      })
    }),
    null
  );

  const clean = normalizePurchaseLineInput({
    lineIndex: 1,
    lineType: "purchase",
    rawItemDescription: "Butter",
    quantity: 4,
    unitOfMeasure: "lb",
    unitPrice: 2,
    extendedPrice: 8,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.deepEqual(clean.consistencyFlags, []);
  assert.equal(clean.parseConfidence, "confirmed");

  // Stated pack size that conflicts with the description still reconstructs
  // from stored pack_size + extract(raw) the same way ingest does.
  const packConflict = normalizePurchaseLineInput({
    lineIndex: 2,
    lineType: "purchase",
    rawItemDescription: "Olive Oil 10 oz",
    packSize: "5 lb",
    quantity: 1,
    unitOfMeasure: "each",
    unitPrice: 4,
    extendedPrice: 4,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.ok(packConflict.consistencyFlags.includes("pack_size_conflicts_description"));
  const fromStated = computePurchaseLineConsistencyFlags({
    quantity: packConflict.quantity,
    unitOfMeasure: packConflict.unitOfMeasure,
    packSize: packConflict.packSize,
    unitPrice: packConflict.unitPrice,
    extendedPrice: packConflict.extendedPrice,
    transactionDate: packConflict.transactionDate,
    receivedDate: packConflict.receivedDate,
    statedPackSize: "5 lb",
    describedPackSize: normalizePurchaseLineDescription("Olive Oil 10 oz").packSize
  });
  assert.deepEqual(packConflict.consistencyFlags, fromStated);
  assert.equal(
    validatePurchaseLineConsistencyFlagsEvidence({
      consistencyFlags: packConflict.consistencyFlags,
      expectedConsistencyFlags: expectedStoredFlags({
        quantity: packConflict.quantity,
        unitOfMeasure: packConflict.unitOfMeasure,
        packSize: packConflict.packSize,
        unitPrice: packConflict.unitPrice,
        extendedPrice: packConflict.extendedPrice,
        transactionDate: packConflict.transactionDate,
        receivedDate: packConflict.receivedDate,
        rawItemDescription: packConflict.rawItemDescription
      })
    }),
    null
  );
});

test("additive migration pins the BEFORE INSERT consistency-flags match guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_consistency_flags_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_consistency_flags_evidence/
  );
  assert.match(migration, /purchase_lines_consistency_flags_match_check/);
  assert.match(
    migration,
    /Purchase line consistency flags must match the recorded line evidence/
  );
  assert.match(migration, /private\.purchase_line_expected_consistency_flags/);
  assert.match(evidence, /invalid_consistency_flags/);
  assert.match(domain, /validatePurchaseLineConsistencyFlagsEvidence/);
  assert.match(pgTap, /select plan\(12\);/);
  assert.equal(
    (pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []).length,
    12
  );
});
