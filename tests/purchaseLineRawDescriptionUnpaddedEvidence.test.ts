import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePurchaseLineInput } from "../services/domain/purchaseLines";
import { validatePurchaseLineRawItemDescriptionEvidence } from "../services/domain/purchaseLineRawDescriptionEvidence";

const migrationPath =
  "supabase/migrations/20261126130000_purchase_line_raw_description_unpadded_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_raw_description_unpadded_evidence.test.sql",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");
const evidence = readFileSync(
  "services/domain/purchaseLineRawDescriptionEvidence.ts",
  "utf8"
);

test("validatePurchaseLineRawItemDescriptionEvidence rejects blank and padded descriptions", () => {
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: null
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: undefined
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: ""
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: "   "
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: "\t\n"
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: "  Onions  "
    }),
    "invalid_raw_item_description_shape"
  );
  assert.equal(
    validatePurchaseLineRawItemDescriptionEvidence({
      rawItemDescription: "Onions"
    }),
    null
  );
});

test("normalizePurchaseLineInput fails closed on blank or padded raw descriptions", () => {
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "   ",
        transactionDate: "2026-11-26",
        parseConfidence: "could_not_verify"
      }),
    /Raw item description must be non-blank and unpadded/
  );
  assert.throws(
    () =>
      normalizePurchaseLineInput({
        lineIndex: 0,
        lineType: "purchase",
        rawItemDescription: "  Onions  ",
        transactionDate: "2026-11-26",
        parseConfidence: "could_not_verify"
      }),
    /Raw item description must be non-blank and unpadded/
  );
  const clean = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Onions",
    transactionDate: "2026-11-26",
    parseConfidence: "could_not_verify"
  });
  assert.equal(clean.rawItemDescription, "Onions");
});

test("additive migration pins the BEFORE INSERT raw-description unpadded guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_raw_description_unpadded_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_raw_description_unpadded_evidence/
  );
  assert.match(
    migration,
    /Purchase line raw item description must be non-blank and unpadded/
  );
  assert.match(migration, /purchase_lines_raw_item_description_unpadded_check/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_line_raw_description_unpadded_evidence\(\)[\s\S]*service_role/
  );
  assert.match(domain, /validatePurchaseLineRawItemDescriptionEvidence/);
  assert.match(evidence, /invalid_raw_item_description_shape/);
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
  assert.equal(planned, 10);
  assert.match(pgTap, /pg_temp\.error_of/);
  assert.match(
    pgTap,
    /Purchase line raw item description must be non-blank and unpadded/
  );
  assert.match(pgTap, /whitespace-only raw_item_description/);
  assert.match(pgTap, /tab\/newline-only raw_item_description/);
  assert.match(pgTap, /padded raw_item_description/);
  assert.match(pgTap, /RPC blank rawItemDescription still fails closed/);
  assert.match(pgTap, /RPC padded rawItemDescription still trims/);
  assert.match(pgTap, /trimmed non-empty raw_item_description/);
  assert.match(pgTap, /legitimate trimmed raw item descriptions remain recordable/);
});
