import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PURCHASE_LINE_EVIDENCE_VERSION,
  PURCHASE_LINE_NORMALIZATION_VERSION,
} from "../services/domain/purchaseLines";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260928200000_mise_005bu_purchase_line_version_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original004c = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_line_version_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const VERSION_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005BU pins purchase-line version CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005BU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_lines_normalization_version_check check \(\s*normalization_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint purchase_lines_evidence_version_check check \(\s*evidence_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(
      `normalization_version collate "C" ~ '${VERSION_PATTERN}'`
    ),
    "normalization_version CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`evidence_version collate "C" ~ '${VERSION_PATTERN}'`),
    "evidence_version CHECK must pin under COLLATE C"
  );

  // Compose: CHECK-only. Do not rewrite currency, item key, or writers.
  assert.doesNotMatch(sqlBody, /purchase_lines_currency/i);
  assert.doesNotMatch(sqlBody, /normalized_item_key/i);
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.ingest_purchase_lines/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function public\.supersede_purchase_line/i
  );
  assert.doesNotMatch(
    sqlBody,
    /create or replace function private\.append_purchase_line/i
  );
  assert.doesNotMatch(sqlBody, /alter table public\.purchase_decision_events/i);
  assert.doesNotMatch(sqlBody, /alter table private\.supplier_email_deliveries/i);
});

test("original purchase-line versions used bare equality without COLLATE C shape", () => {
  assert.match(
    original004c,
    /normalization_version text not null default 'mise\.purchase_line_normalization\.v1'\s*check \(normalization_version = 'mise\.purchase_line_normalization\.v1'\)/
  );
  assert.match(
    original004c,
    /evidence_version text not null default 'mise\.purchase_line\.v1'\s*check \(evidence_version = 'mise\.purchase_line\.v1'\)/
  );
  assert.doesNotMatch(
    original004c,
    /normalization_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original004c,
    /evidence_version collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.equal(
    PURCHASE_LINE_NORMALIZATION_VERSION,
    "mise.purchase_line_normalization.v1"
  );
  assert.equal(PURCHASE_LINE_EVIDENCE_VERSION, "mise.purchase_line.v1");
  assert.match(PURCHASE_LINE_NORMALIZATION_VERSION, /^[A-Za-z0-9._-]{1,80}$/);
  assert.match(PURCHASE_LINE_EVIDENCE_VERSION, /^[A-Za-z0-9._-]{1,80}$/);
});

test("pgTAP fixture pins purchase-line version shapes to COLLATE C", () => {
  assert.match(pgTap, /select plan\(11\)/);
  assert.match(pgTap, /purchase_lines_normalization_version_check exists/);
  assert.match(pgTap, /purchase_lines_evidence_version_check exists/);
  assert.match(pgTap, /normalization_version CHECK uses COLLATE C/);
  assert.match(pgTap, /evidence_version CHECK uses COLLATE C/);
  assert.match(
    pgTap,
    /writer normalization_version matches under COLLATE C/
  );
  assert.match(pgTap, /writer evidence_version matches under COLLATE C/);
  assert.match(
    pgTap,
    /spaced normalization_version is rejected under COLLATE C/
  );
  assert.match(pgTap, /spaced evidence_version is rejected under COLLATE C/);
  assert.match(
    pgTap,
    /empty purchase-line version token is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /punctuated evidence_version is rejected under COLLATE C/
  );
  assert.match(
    pgTap,
    /non-ASCII evidence_version is rejected under COLLATE C/
  );
});
