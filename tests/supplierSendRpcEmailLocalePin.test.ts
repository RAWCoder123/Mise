import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  foldAsciiUpperCase,
  matchesSupplierSendEmailShape,
  normalizeSupplierSendEmail,
  SUPPLIER_SEND_EMAIL_SHAPE
} from "../services/domain/supplierSendContent";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926113000_mise_005q_supplier_send_rpc_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original003c = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_send_rpc_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const demoDomain = readFileSync(
  new URL("../services/domain/supplierSendContent.ts", import.meta.url),
  "utf8"
);

test("MISE-005Q pins build_supplier_send_content From/To/subject to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005Q"), "additive pin must stay labeled");
  assert.match(
    migration,
    /create or replace function private\.build_supplier_send_content\(\s*p_restaurant_id uuid,\s*p_order_id uuid/i
  );
  assert.match(
    migration,
    /pg_catalog\.btrim\(connection\.sender_email\) collate "C"/
  );
  assert.match(
    migration,
    /pg_catalog\.btrim\(recipient\.email\) collate "C"/
  );
  assert.match(migration, /canonical_from collate "C" ~ '\[\[:cntrl:\]\]'/);
  assert.match(migration, /canonical_to collate "C" ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    migration,
    /canonical_from collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    migration,
    /canonical_to collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(migration, /canonical_subject collate "C" ~ '\[\[:cntrl:\]\]'/);
  // Compose with MISE-005N/005O/005P: do not reattach sibling CHECKs or rewrite claim.
  assert.doesNotMatch(migration, /gmail_credentials_sender_email_check/);
  assert.doesNotMatch(migration, /supplier_recipients_email_format_check/);
  assert.doesNotMatch(
    migration,
    /supplier_email_deliveries_mise_003c_metadata_check/
  );
  assert.doesNotMatch(
    migration,
    /create or replace function private\.service_claim_supplier_email_send/i
  );
  assert.doesNotMatch(
    migration,
    /create or replace function public\.approve_supplier_send_content/i
  );
});

test("MISE-003C originally left build From/To/subject on bare lower/cntrl/space", () => {
  assert.match(
    original003c,
    /canonical_from := pg_catalog\.lower\(pg_catalog\.btrim\(connection\.sender_email\)\);/
  );
  assert.match(
    original003c,
    /canonical_to := pg_catalog\.lower\(pg_catalog\.btrim\(recipient\.email\)\);/
  );
  assert.match(original003c, /canonical_from ~ '\[\[:cntrl:\]\]'/);
  assert.match(original003c, /canonical_to ~ '\[\[:cntrl:\]\]'/);
  assert.match(
    original003c,
    /canonical_from !~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'/
  );
  assert.match(original003c, /canonical_subject ~ '\[\[:cntrl:\]\]'/);
  assert.doesNotMatch(original003c, /canonical_from collate "C"/);
  assert.doesNotMatch(original003c, /canonical_to collate "C"/);
  assert.doesNotMatch(original003c, /canonical_subject collate "C"/);
});

test("pgTAP fixture pins build From/To/subject fail-closed to COLLATE C", () => {
  assert.match(pgTap, /select plan\(8\)/);
  assert.match(pgTap, /build From lower\/btrim uses COLLATE C/);
  assert.match(pgTap, /build To lower\/btrim uses COLLATE C/);
  assert.match(pgTap, /build From cntrl fail-closed uses COLLATE C/);
  assert.match(pgTap, /build To cntrl fail-closed uses COLLATE C/);
  assert.match(pgTap, /build From shape fail-closed uses COLLATE C \[\[:space:\]\]/);
  assert.match(pgTap, /build To shape fail-closed uses COLLATE C \[\[:space:\]\]/);
  assert.match(pgTap, /build subject cntrl fail-closed uses COLLATE C/);
});

test("Demo supplier-send helpers mirror ASCII C [[:space:]] rejection and A-Z lower", () => {
  assert.match(demoDomain, /MISE-005Q/);
  assert.match(demoDomain, /SUPPLIER_SEND_EMAIL_SHAPE/);
  assert.equal(SUPPLIER_SEND_EMAIL_SHAPE.source.includes("\\s"), false);
  assert.equal(matchesSupplierSendEmailShape("orders@fresh.test"), true);
  assert.equal(matchesSupplierSendEmailShape("orders\t@fresh.test"), false);
  assert.equal(matchesSupplierSendEmailShape("orders\n@fresh.test"), false);
  assert.equal(matchesSupplierSendEmailShape("orders fresh@test.example"), false);
  assert.equal(matchesSupplierSendEmailShape("not-an-email"), false);
  // JS \\s would reject NBSP; COLLATE C [[:space:]] does not treat U+00A0 as space.
  assert.equal(matchesSupplierSendEmailShape("orders\u00a0@fresh.test"), true);
  assert.equal(
    normalizeSupplierSendEmail(" ORDERS@Fresh.Example "),
    "orders@fresh.example"
  );
  // A-Z fold only: keep Latin-1 capital É unchanged (matches lower(... COLLATE "C")).
  assert.equal(foldAsciiUpperCase("CAFÉ@Fresh.Example"), "cafÉ@fresh.example");
  assert.equal(
    normalizeSupplierSendEmail("CAFÉ@Fresh.Example"),
    "cafÉ@fresh.example"
  );
});
