import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import {
  validatePurchaseLinePackSizeEvidence,
  validatePurchaseLineUnitOfMeasureEvidence
} from "../services/domain/purchaseLineUnitPackEvidence";

const migrationPath =
  "supabase/migrations/20261126120000_purchase_line_unit_pack_unpadded_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_unit_pack_unpadded_evidence.test.sql",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");
const evidence = readFileSync(
  "services/domain/purchaseLineUnitPackEvidence.ts",
  "utf8"
);

test("validatePurchaseLineUnitOfMeasureEvidence rejects padded units", () => {
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: null }),
    null
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: undefined }),
    null
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: "" }),
    null
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: "   " }),
    null
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: "  lb  " }),
    "invalid_unit_of_measure_shape"
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: "\tlb\t" }),
    "invalid_unit_of_measure_shape"
  );
  assert.equal(
    validatePurchaseLineUnitOfMeasureEvidence({ unitOfMeasure: "lb" }),
    null
  );
});

test("validatePurchaseLinePackSizeEvidence rejects padded pack sizes", () => {
  assert.equal(validatePurchaseLinePackSizeEvidence({ packSize: null }), null);
  assert.equal(
    validatePurchaseLinePackSizeEvidence({ packSize: undefined }),
    null
  );
  assert.equal(validatePurchaseLinePackSizeEvidence({ packSize: "" }), null);
  assert.equal(validatePurchaseLinePackSizeEvidence({ packSize: "   " }), null);
  assert.equal(
    validatePurchaseLinePackSizeEvidence({ packSize: "  6x12oz  " }),
    "invalid_pack_size_shape"
  );
  assert.equal(
    validatePurchaseLinePackSizeEvidence({ packSize: "6x12oz" }),
    null
  );
});

test("normalizePurchaseLineInput fails closed on padded unit and pack labels", () => {
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "Onions",
        transactionDate: "2026-11-26",
        parseConfidence: "could_not_verify",
        unitOfMeasure: "  lb  "
      }),
    /Unit of measure must be unpadded when present/
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "Onions",
        transactionDate: "2026-11-26",
        parseConfidence: "could_not_verify",
        packSize: "  6x12oz  "
      }),
    /Pack size must be unpadded when present/
  );
  const softEmpty = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Onions",
    transactionDate: "2026-11-26",
    parseConfidence: "could_not_verify",
    unitOfMeasure: "   ",
    packSize: "   "
  });
  assert.equal(softEmpty.unitOfMeasure, null);
  assert.equal(softEmpty.packSize, null);
  const clean = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Onions",
    transactionDate: "2026-11-26",
    parseConfidence: "could_not_verify",
    unitOfMeasure: "lb",
    packSize: "6x12oz"
  });
  assert.equal(clean.unitOfMeasure, "lb");
  assert.equal(clean.packSize, "6x12oz");
});

test("additive migration pins the BEFORE INSERT unit/pack unpadded guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_unit_pack_unpadded_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_unit_pack_unpadded_evidence/
  );
  assert.match(
    migration,
    /Purchase line unit of measure must be unpadded when present/
  );
  assert.match(migration, /Purchase line pack size must be unpadded when present/);
  assert.match(migration, /purchase_lines_unit_of_measure_unpadded_check/);
  assert.match(migration, /purchase_lines_pack_size_unpadded_check/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_line_unit_pack_unpadded_evidence\(\)[\s\S]*service_role/
  );
  assert.match(domain, /validatePurchaseLineUnitOfMeasureEvidence/);
  assert.match(domain, /validatePurchaseLinePackSizeEvidence/);
  assert.match(evidence, /invalid_unit_of_measure_shape/);
  assert.match(evidence, /invalid_pack_size_shape/);
});

test("pgTAP plan equals assertion call sites and covers forged plus legitimate paths", () => {
  const planMatch = /select plan\((\d+)\);/.exec(pgTap);
  assert.ok(planMatch);
  const planned = Number(planMatch?.[1]);
  const assertionSites = (
    pgTap.match(/^select (?:is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(
    planned,
    assertionSites,
    "plan must be derived from assertion call sites, never from a passing run"
  );
  assert.equal(planned, 12);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(
    pgTap,
    /Purchase line unit of measure must be unpadded when present/
  );
  assert.match(pgTap, /Purchase line pack size must be unpadded when present/);
  assert.match(pgTap, /padded unit_of_measure/);
  assert.match(pgTap, /padded pack_size/);
  assert.match(pgTap, /RPC padded unitOfMeasure still trims/);
  assert.match(pgTap, /RPC padded packSize still trims/);
  assert.match(pgTap, /trimmed unit_of_measure and pack_size/);
  assert.match(pgTap, /null unit_of_measure and pack_size/);
  assert.match(pgTap, /legitimate trimmed unit and pack labels remain recordable/);
});
