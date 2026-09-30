import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260930260000_mise_005dl_purchase_lines_line_type_parse_confidence_locale_pin.sql",
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
    "../supabase/tests/database/purchase_lines_line_type_parse_confidence_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const TOKEN_PATTERN = "^[A-Za-z0-9._-]{1,80}$";

test("MISE-005DL pins purchase_lines line_type and parse_confidence CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005DL"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint purchase_lines_line_type_check\s+check \(\s*line_type in \('purchase', 'credit'\)\s*and line_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );
  assert.match(
    migration,
    /add constraint purchase_lines_parse_confidence_check\s+check \(\s*parse_confidence in \('confirmed', 'estimated', 'could_not_verify'\)\s*and parse_confidence collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'\s*\)/
  );

  assert.ok(
    migration.includes(`line_type collate "C" ~ '${TOKEN_PATTERN}'`),
    "line_type CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes(`parse_confidence collate "C" ~ '${TOKEN_PATTERN}'`),
    "parse_confidence CHECK must pin under COLLATE C"
  );
  assert.ok(
    migration.includes("'purchase'") && migration.includes("'credit'"),
    "exact line_type allowlist must be preserved"
  );
  assert.ok(
    migration.includes("'confirmed'") &&
      migration.includes("'estimated'") &&
      migration.includes("'could_not_verify'"),
    "exact parse_confidence allowlist must be preserved"
  );

  // Compose: CHECK-only. Do not rewrite writers or contested open stacks.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /ingest_purchase_lines/i);
  assert.doesNotMatch(sqlBody, /supersede_purchase_line/i);
  assert.doesNotMatch(sqlBody, /purchase_lines_source_check/i);
  assert.doesNotMatch(sqlBody, /normalization_version/i);
  assert.doesNotMatch(sqlBody, /evidence_version/i);
  assert.doesNotMatch(sqlBody, /generation_provider/i);
  assert.doesNotMatch(sqlBody, /alter table public\.pos_integrations/i);
  assert.doesNotMatch(sqlBody, /alter table public\.ai_insights/i);
  assert.doesNotMatch(sqlBody, /alter table public\.outreach_messages/i);
});

test("original purchase_lines vocabulary columns used bare IN without COLLATE C shape", () => {
  assert.match(original, /line_type text check \(line_type in \('purchase', 'credit'\)\)/);
  assert.match(
    original,
    /parse_confidence text not null check \(\s*parse_confidence in \('confirmed', 'estimated', 'could_not_verify'\)\s*\)/
  );
  assert.doesNotMatch(
    original,
    /line_type collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
  assert.doesNotMatch(
    original,
    /parse_confidence collate "C" ~ '\^\[A-Za-z0-9\._-\]\{1,80\}\$'/
  );
});

test("pgTAP fixture pins purchase_lines vocabulary to COLLATE C", () => {
  assert.match(pgTap, /select plan\(21\)/);
  assert.match(pgTap, /purchase_lines_line_type_check exists/);
  assert.match(pgTap, /purchase_lines line_type CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_lines line_type CHECK uses COLLATE C/);
  assert.match(pgTap, /purchase_lines_parse_confidence_check exists/);
  assert.match(pgTap, /purchase_lines parse_confidence CHECK keeps exact allowlist/);
  assert.match(pgTap, /purchase_lines parse_confidence CHECK uses COLLATE C/);
  assert.match(pgTap, /writer token purchase matches under COLLATE C/);
  assert.match(pgTap, /writer token credit matches under COLLATE C/);
  assert.match(pgTap, /writer token confirmed matches under COLLATE C/);
  assert.match(pgTap, /writer token estimated matches under COLLATE C/);
  assert.match(pgTap, /writer token could_not_verify matches under COLLATE C/);
  assert.match(pgTap, /spaced line_type token is rejected under COLLATE C/);
  assert.match(pgTap, /spaced parse_confidence token is rejected under COLLATE C/);
  assert.match(pgTap, /empty line_type token is rejected under COLLATE C/);
  assert.match(pgTap, /empty parse_confidence token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated line_type token is rejected under COLLATE C/);
  assert.match(pgTap, /punctuated parse_confidence token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII line_type token is rejected under COLLATE C/);
  assert.match(pgTap, /non-ASCII parse_confidence token is rejected under COLLATE C/);
  assert.match(pgTap, /all allowlisted line_type tokens match under COLLATE C/);
  assert.match(pgTap, /all allowlisted parse_confidence tokens match under COLLATE C/);
});
