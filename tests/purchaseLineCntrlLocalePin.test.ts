import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926002000_mise_005f_purchase_line_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const ledger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const domain = readFileSync(
  new URL("../services/domain/purchaseLines.ts", import.meta.url),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/purchase_line_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);

const CHECK_SITES = [
  "purchase_lines_source_document_reference_check",
  "purchase_lines_raw_item_description_check",
  "purchase_lines_unit_of_measure_check",
  "purchase_lines_pack_size_check"
] as const;

test("MISE-005F pins purchase_lines cntrl CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005F"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.purchase_line_has_control_characters[\s\S]*collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /create or replace function private\.purchase_line_text[\s\S]*purchase_line_has_control_characters/
  );
  for (const name of CHECK_SITES) {
    assert.match(
      migration,
      new RegExp(`drop constraint if exists ${name}`, "i"),
      `must drop ${name}`
    );
  }
  assert.match(
    migration,
    /add constraint purchase_lines_source_document_reference_check[\s\S]*?collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /add constraint purchase_lines_raw_item_description_check[\s\S]*?collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /add constraint purchase_lines_unit_of_measure_check[\s\S]*?collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /add constraint purchase_lines_pack_size_check[\s\S]*?collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  // Compose with open stacks: do not rewrite ingest or append bodies.
  assert.doesNotMatch(migration, /create or replace function public\.ingest_purchase_lines/i);
  assert.doesNotMatch(migration, /create or replace function private\.append_purchase_line/i);
});

test("MISE-004C originally left cntrl CHECKs unpinned (prove the gap existed)", () => {
  assert.match(
    ledger,
    /source_document_reference !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(ledger, /raw_item_description !~ '\[\[:cntrl:\]\]'/);
  assert.match(ledger, /unit_of_measure !~ '\[\[:cntrl:\]\]'/);
  assert.match(ledger, /pack_size !~ '\[\[:cntrl:\]\]'/);
  assert.match(
    ledger,
    /when pg_catalog\.btrim\(p_line ->> p_key\) ~ '\[\[:cntrl:\]\]' then null/
  );
  assert.doesNotMatch(
    ledger,
    /source_document_reference collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("TypeScript control rejection matches ASCII C [[:cntrl:]]", () => {
  // Domain already rejects U+0000–U+001F and U+007F — the C-locale [[:cntrl:]]
  // set — rather than Unicode-aware \p{Cc} / \s.
  assert.match(
    domain,
    /CONTROL_CHARACTERS = \/\[\\u0000-\\u001f\\u007f\]\/u/
  );
  assert.match(domain, /MISE-005F/);
});

test("pgTAP fixture pins every CHECK site and the helper", () => {
  assert.match(pgTap, /select plan\(12\)/);
  assert.match(pgTap, /purchase_line_has_control_characters/);
  for (const name of CHECK_SITES) {
    assert.match(pgTap, new RegExp(name));
  }
  assert.match(pgTap, /collate "C"/);
  assert.match(pgTap, /en_US\.utf8/);
});
