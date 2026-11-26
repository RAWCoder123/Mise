import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validatePurchaseLineCreditLinkTargetEvidence } from "../services/domain/purchaseLineCreditLinkTargetEvidence";
import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";

const migrationPath =
  "supabase/migrations/20261126160000_purchase_line_credit_link_target_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_credit_link_target_evidence.test.sql",
  "utf8"
);
const evidence = readFileSync(
  "services/domain/purchaseLineCreditLinkTargetEvidence.ts",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");

const NIL_SUPPLIER_SCOPE = "00000000-0000-0000-0000-000000000000";
const SUPPLIER_A = "c0000000-0000-4000-8000-000000000091";
const SUPPLIER_B = "c0000000-0000-4000-8000-000000000092";
const PURCHASE_ID = "c0000000-0000-4000-8000-0000000000a1";
const CREDIT_ID = "c0000000-0000-4000-8000-0000000000c1";

test("validatePurchaseLineCreditLinkTargetEvidence allows absent links", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: null,
      lineType: "credit"
    }),
    null
  );
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: "   ",
      lineType: "credit"
    }),
    null
  );
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: undefined,
      lineType: "purchase"
    }),
    null
  );
});

test("validatePurchaseLineCreditLinkTargetEvidence rejects purchase rows that name a target", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: PURCHASE_ID,
      lineType: "purchase",
      targetLineType: "purchase",
      targetSupplierScope: SUPPLIER_A,
      creditSupplierScope: SUPPLIER_A
    }),
    "invalid_credit_link_target"
  );
});

test("validatePurchaseLineCreditLinkTargetEvidence rejects credit-to-credit targets", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: CREDIT_ID,
      lineType: "credit",
      targetLineType: "credit",
      targetSupplierScope: SUPPLIER_A,
      creditSupplierScope: SUPPLIER_A
    }),
    "invalid_credit_link_target"
  );
});

test("validatePurchaseLineCreditLinkTargetEvidence rejects cross-supplier purchase targets", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: PURCHASE_ID,
      lineType: "credit",
      targetLineType: "purchase",
      targetSupplierScope: SUPPLIER_B,
      creditSupplierScope: SUPPLIER_A
    }),
    "invalid_credit_link_target"
  );
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: PURCHASE_ID,
      lineType: "credit",
      targetLineType: "purchase",
      targetSupplierScope: SUPPLIER_A,
      creditSupplierScope: NIL_SUPPLIER_SCOPE
    }),
    "invalid_credit_link_target"
  );
});

test("validatePurchaseLineCreditLinkTargetEvidence accepts same-supplier purchase targets", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: PURCHASE_ID,
      lineType: "credit",
      targetLineType: "purchase",
      targetSupplierScope: SUPPLIER_A,
      creditSupplierScope: SUPPLIER_A
    }),
    null
  );
});

test("validatePurchaseLineCreditLinkTargetEvidence stays open when target evidence is unknown", () => {
  assert.equal(
    validatePurchaseLineCreditLinkTargetEvidence({
      creditsLineId: PURCHASE_ID,
      lineType: "credit"
    }),
    null
  );
});

test("normalizePurchaseLineInput still rejects creditsLineId on purchase rows", () => {
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        creditsLineId: PURCHASE_ID,
        rawItemDescription: "Onions",
        quantity: 1,
        unitOfMeasure: "lb",
        unitPrice: 3,
        extendedPrice: 3,
        currency: "USD",
        transactionDate: "2026-11-26",
        parseConfidence: "confirmed"
      }),
    /Only a credit line may reference the line it offsets/
  );
});

test("normalizePurchaseLineInput still allows a credit that names a creditsLineId", () => {
  const normalized = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "credit",
    creditsLineId: ` ${PURCHASE_ID} `,
    rawItemDescription: "Onions",
    quantity: 1,
    unitOfMeasure: "lb",
    unitPrice: 3,
    extendedPrice: 3,
    currency: "USD",
    transactionDate: "2026-11-26",
    parseConfidence: "confirmed"
  });
  assert.equal(normalized.creditsLineId, PURCHASE_ID);
  assert.equal(normalized.lineType, "credit");
});

test("additive migration pins the BEFORE INSERT credit-link target guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_credit_link_target_evidence\(\)/
  );
  assert.match(
    migration,
    /create trigger purchase_lines_credit_link_target_evidence/
  );
  assert.match(migration, /Credits may only reference purchase lines/);
  assert.match(
    migration,
    /Credited purchase line is not available for this supplier/
  );
  assert.match(
    migration,
    /coalesce\(\s*new\.supplier_id,\s*'00000000-0000-0000-0000-000000000000'::uuid\s*\)/
  );
  assert.doesNotMatch(migration, /create or replace function public\.append_purchase_line/);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/);
  assert.doesNotMatch(migration, /purchase_line_credit_attachments/);
});

test("pgTAP plan is derived from assertion call sites", () => {
  const assertionCount = (
    pgTap.match(/^select (is|isnt|ok|matches|has_function)\(/gm) ?? []
  ).length;
  assert.equal(assertionCount, 11);
  assert.match(pgTap, /select plan\(11\);/);
  assert.match(pgTap, /Credits may only reference purchase lines/);
  assert.match(
    pgTap,
    /direct insert rejects credits_line_id pointing at another credit/
  );
  assert.match(
    pgTap,
    /direct insert rejects credits_line_id pointing at another supplier purchase/
  );
  assert.match(
    pgTap,
    /RPC rejects creditsLineId pointing at another credit under the same supplier/
  );
});

test("evidence module documents the forgeable path closed by this tip", () => {
  assert.match(evidence, /does not require the named row to be a purchase/i);
  assert.match(evidence, /invalid_credit_link_target/);
  assert.match(domain, /Only a credit line may reference the line it offsets/);
});
