import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007140000_mise_005iy_ingest_document_reference_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalLedger = readFileSync(
  new URL(
    "../supabase/migrations/20260903120000_mise_004c_purchase_line_ledger.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/ingest_document_reference_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const application = readFileSync(
  new URL("../services/application/purchaseLines.ts", import.meta.url),
  "utf8"
);

test("MISE-005IY pins ingest document-reference cntrl preflight to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005IY"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function public\.ingest_purchase_lines\(\s*p_restaurant_id uuid,\s*p_source text,\s*p_source_document_reference text,\s*p_lines jsonb/i
  );
  assert.match(
    migration,
    /or document_reference collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /pg_catalog\.length\(document_reference\) > 200/
  );
  assert.match(
    migration,
    /grant execute on function public\.ingest_purchase_lines\(\s*uuid, text, text, jsonb, uuid, uuid\s*\)\s*to authenticated/i
  );
  assert.match(
    migration,
    /revoke all on function public\.ingest_purchase_lines\(\s*uuid, text, text, jsonb, uuid, uuid\s*\)\s*from public, anon, authenticated, service_role/i
  );

  const functionBody = migration.slice(
    migration.indexOf("create or replace function public.ingest_purchase_lines")
  );
  assert.doesNotMatch(
    functionBody,
    /or document_reference ~ '\[\[:cntrl:\]\]'/
  );

  // Compose: do not reattach CHECKs (#414), rewrite purchase_line_text (#414),
  // add octet bound (#415), or tip unit helpers (#666).
  assert.doesNotMatch(
    migration,
    /purchase_lines_source_document_reference_check/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.purchase_line_text/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.purchase_line_has_control_characters/i
  );
  assert.doesNotMatch(migration, /octet_length\s*\(\s*p_lines/i);
  assert.doesNotMatch(
    migration,
    /create or replace function private\.purchase_line_unit_dimension/i
  );
});

test("MISE-004C originally left ingest document-reference cntrl preflight unpinned", () => {
  const ingestBody = originalLedger.slice(
    originalLedger.indexOf(
      "create or replace function public.ingest_purchase_lines"
    ),
    originalLedger.indexOf(
      "create or replace function public.supersede_purchase_line"
    )
  );
  assert.match(ingestBody, /or document_reference ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(
    ingestBody,
    /or document_reference collate "C" ~ '\[\[:cntrl:\]\]'/
  );
});

test("application ingest rejects control characters in document references", () => {
  assert.match(
    application,
    /PURCHASE_LINE_SOURCE_DOCUMENT_REFERENCE_MAX/
  );
  assert.match(
    application,
    /CONTROL_CHARACTERS\.test\(sourceDocumentReference\)/
  );
  assert.match(
    application,
    /sourceDocumentReference\.length > PURCHASE_LINE_SOURCE_DOCUMENT_REFERENCE_MAX/
  );
});

test("pgTAP fixture pins ingest document-reference cntrl preflight to COLLATE C", () => {
  // Plan count must equal assertion call sites in the fixture source.
  const assertionCalls = (
    pgTap.match(/^select (?:ok|is|isnt|matches|throws_ok)\(/gm) ?? []
  ).length;
  assert.equal(assertionCalls, 6);
  assert.match(pgTap, /select plan\(6\)/);
  assert.match(
    pgTap,
    /ingest document-reference cntrl preflight uses COLLATE C/
  );
  assert.match(
    pgTap,
    /ingest document-reference cntrl preflight is not bare POSIX/
  );
  assert.match(pgTap, /authenticated retains EXECUTE on ingest_purchase_lines/);
  assert.match(pgTap, /anon lacks EXECUTE on ingest_purchase_lines/);
});
