import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineCreditMemoLineTypeEvidence } from "../services/domain/purchaseLineCreditMemoLineTypeEvidence";
import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";

const migrationPath =
  "supabase/migrations/20261126170000_purchase_line_credit_memo_line_type_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_credit_memo_line_type_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseLineCreditMemoLineTypeEvidence.ts",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");

test("validatePurchaseLineCreditMemoLineTypeEvidence allows non-credit-memo sources", () => {
  for (const source of ["invoice", "order_confirmation", "manual_entry"] as const) {
    assert.equal(
      validatePurchaseLineCreditMemoLineTypeEvidence({
        source,
        lineType: "purchase"
      }),
      null
    );
    assert.equal(
      validatePurchaseLineCreditMemoLineTypeEvidence({
        source,
        lineType: "credit"
      }),
      null
    );
  }
});

test("validatePurchaseLineCreditMemoLineTypeEvidence rejects credit_memo purchases", () => {
  assert.equal(
    validatePurchaseLineCreditMemoLineTypeEvidence({
      source: "credit_memo",
      lineType: "purchase"
    }),
    "invalid_credit_memo_line_type"
  );
  assert.equal(
    validatePurchaseLineCreditMemoLineTypeEvidence({
      source: " credit_memo ",
      lineType: "purchase"
    }),
    "invalid_credit_memo_line_type"
  );
  assert.equal(
    validatePurchaseLineCreditMemoLineTypeEvidence({
      source: "credit_memo",
      lineType: "adjustment"
    }),
    "invalid_credit_memo_line_type"
  );
});

test("validatePurchaseLineCreditMemoLineTypeEvidence accepts credit_memo credits", () => {
  assert.equal(
    validatePurchaseLineCreditMemoLineTypeEvidence({
      source: "credit_memo",
      lineType: "credit"
    }),
    null
  );
  assert.equal(
    validatePurchaseLineCreditMemoLineTypeEvidence({
      source: " credit_memo ",
      lineType: "credit"
    }),
    null
  );
});

test("normalizePurchaseLineInput still accepts credit and purchase directions", () => {
  const purchase = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Onions",
    quantity: 1,
    unitOfMeasure: "lb",
    unitPrice: 3,
    extendedPrice: 3,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.equal(purchase.lineType, "purchase");

  const credit = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "credit",
    rawItemDescription: "Onions",
    quantity: 1,
    unitOfMeasure: "lb",
    unitPrice: 3,
    extendedPrice: 3,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.equal(credit.lineType, "credit");
});

test("additive migration pins the BEFORE INSERT credit-memo line-type guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_credit_memo_line_type_evidence\(\)/
  );
  assert.match(
    migration,
    /create trigger purchase_lines_credit_memo_line_type_evidence/
  );
  assert.match(
    migration,
    /Credit memo documents may only contain credit lines/
  );
  assert.match(
    migration,
    /purchase_lines_credit_memo_line_type_check/
  );
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(
    migration,
    /create or replace function public\.append_purchase_line/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.ingest_purchase_lines/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.supersede_purchase_line/
  );
});

test("pgTAP plan is derived from assertion call sites", () => {
  const assertionCount = (
    pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(assertionCount, 10);
  assert.match(pgTap, /select plan\(10\);/);
  assert.match(
    pgTap,
    /Credit memo documents may only contain credit lines/
  );
  assert.match(
    pgTap,
    /direct insert rejects credit_memo with line_type = purchase/
  );
  assert.match(
    pgTap,
    /RPC rejects credit_memo ingestion with a purchase line/
  );
});

test("evidence module documents the forgeable path closed by this tip", () => {
  assert.match(evidence, /Neither couples the two/i);
  assert.match(evidence, /invalid_credit_memo_line_type/);
  assert.match(domain, /credit_memo/);
  assert.match(domain, /lineType/);
});
