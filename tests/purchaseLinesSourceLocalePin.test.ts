import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930280000_mise_005dn_purchase_lines_source_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_lines_source_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DN pins purchase_lines.source CHECK to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DN"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_lines_source_check\s+check \(\s*source in \('invoice', 'order_confirmation', 'manual_entry', 'credit_memo'\)\s*and source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`source collate "C" ~ '${TOKEN_PATTERN}'`),
    "source CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'invoice'") &&
      migration.includes("'order_confirmation'") &&
      migration.includes("'manual_entry'") &&
      migration.includes("'credit_memo'"),
    "exact source allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /ingest_purchase_lines/i);
  assert.doesNotMatch(sqlBody, /supersede_purchase_line/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_line_type_check/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_parse_confidence_check/i);
  assert.doesNotMatch(sqlBody, /normalization_version/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /generation_provider/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
});

test("original purchase_lines.source used bare IN without COLLATE C shape", () => {
  assert.match(
    original,
    /source text not null check \(\s*source in \('invoice', 'order_confirmation', 'manual_entry', 'credit_memo'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /source collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_lines.source to COLLATE C", () => {
  assert.match(pgTap, /select plan\(15\)/);
  assert.match(pgTap, /purchase_lines_source_check exists/);
  assert.match(pgTap, /purchase_lines source CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_lines source CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token invoice matches under COLLATE C/);
  assert.match(pgTap, /writer token order_confirmation matches under COLLATE C/);
  assert.match(pgTap, /writer token manual_entry matches under COLLATE C/);
  assert.match(pgTap, /writer token credit_memo matches under COLLATE C/);
  assert.match(pgTap, /spaced source token is rejected under COLLATE C/);
  assert.match(pgTap, /empty source token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated source token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII source token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted source tokens match under COLLATE C/);
  assert.match(pgTap, /ASCII-shaped Invoice passes shape gate alone under COLLATE C/);
  assert.match(pgTap, /case-shifted INVOICE fails exact allowlist/);
  assert.match(pgTap, /trailing-space source token is rejected under COLLATE C/);
});
