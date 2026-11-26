import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizePurchaseLineDescription,
  normalizePurchaseLineInput
} from "../services/domain/purchaseLines";
import { validatePurchaseLineNormalizedItemKeyEvidence } from "../services/domain/purchaseLineNormalizedItemKeyEvidence";

const migrationPath =
  "supabase/migrations/20261126140000_purchase_line_normalized_item_key_unpadded_evidence.sql";
const migration = readFileSync(migrationPath, "utf8");
const pgTap = readFileSync(
  "supabase/tests/database/purchase_line_normalized_item_key_unpadded_evidence.test.sql",
  "utf8"
);
const domain = readFileSync("services/domain/purchaseLines.ts", "utf8");
const evidence = readFileSync(
  "services/domain/purchaseLineNormalizedItemKeyEvidence.ts",
  "utf8"
);

test("validatePurchaseLineNormalizedItemKeyEvidence rejects padded keys", () => {
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: null
    }),
    null
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: undefined
    }),
    null
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: ""
    }),
    null
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: "   "
    }),
    null
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: "  onions  "
    }),
    "invalid_normalized_item_key_shape"
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: "\tonions\t"
    }),
    "invalid_normalized_item_key_shape"
  );
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: "onions"
    }),
    null
  );
});

test("normalizePurchaseLineInput keeps unpadded keys that match description folding", () => {
  const clean = normalizePurchaseLineInput({
    lineIndex: 0,
    lineType: "purchase",
    rawItemDescription: "Onions",
    transactionDate: "2026-11-26",
    parseConfidence: "could_not_verify"
  });
  assert.equal(clean.normalizedItemKey, "onions");
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: clean.normalizedItemKey
    }),
    null
  );

  const fromDescription = normalizePurchaseLineDescription("  Onions  ");
  assert.equal(fromDescription.normalizedItemKey, "onions");
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: fromDescription.normalizedItemKey
    }),
    null
  );

  const emptyKey = normalizePurchaseLineDescription("!!!");
  assert.equal(emptyKey.normalizedItemKey, null);
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: emptyKey.normalizedItemKey
    }),
    null
  );

  // Product normalize always derives the key; a forged padded key is refused
  // by the shared evidence helper that normalizePurchaseLineInput consults.
  assert.equal(
    validatePurchaseLineNormalizedItemKeyEvidence({
      normalizedItemKey: "  onions  "
    }),
    "invalid_normalized_item_key_shape"
  );
});

test("additive migration pins the BEFORE INSERT normalized-key unpadded guard", () => {
  assert.match(
    migration,
    /create or replace function private\.enforce_purchase_line_normalized_item_key_unpadded_evidence\(\)/
  );
  assert.match(
    migration,
    /before insert on public\.purchase_lines[\s\S]*enforce_purchase_line_normalized_item_key_unpadded_evidence/
  );
  assert.match(
    migration,
    /Purchase line normalized item key must be unpadded when present/
  );
  assert.match(migration, /purchase_lines_normalized_item_key_unpadded_check/);
  assert.match(migration, /not valid/i);
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
  assert.doesNotMatch(
    migration,
    /drop constraint if exists purchase_lines_normalized_key_check/i
  );
  assert.doesNotMatch(
    migration,
    /add constraint purchase_lines_normalized_key_check/i
  );
  assert.match(
    migration,
    /revoke all on function private\.enforce_purchase_line_normalized_item_key_unpadded_evidence\(\)[\s\S]*service_role/
  );
  assert.match(domain, /validatePurchaseLineNormalizedItemKeyEvidence/);
  assert.match(evidence, /invalid_normalized_item_key_shape/);
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
    /Purchase line normalized item key must be unpadded when present/
  );
  assert.match(pgTap, /padded normalized_item_key/);
  assert.match(pgTap, /tab-padded normalized_item_key/);
  assert.match(pgTap, /purchase_lines_normalized_key_check/);
  assert.match(pgTap, /normalize_purchase_item_key/);
  assert.match(pgTap, /RPC padded rawItemDescription still trims/);
  assert.match(pgTap, /trimmed matching normalized_item_key/);
  assert.match(pgTap, /null normalized_item_key remains allowed/);
  assert.match(pgTap, /legitimate unpadded normalized item keys remain recordable/);
});
