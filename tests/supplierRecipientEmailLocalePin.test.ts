import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  matchesSupplierRecipientEmailShape,
  normalizeSupplierRecipientEmail,
  requireSupplierRecipientInput,
  SUPPLIER_RECIPIENT_EMAIL_SHAPE
} from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926083000_mise_005n_supplier_recipient_email_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalRecipients = readFileSync(
  new URL("../supabase/migrations/20260719214822_supplier_recipient_management.sql", import.meta.url),
  "utf8"
);
const durableIdentity = readFileSync(
  new URL(
    "../supabase/migrations/20260824034152_mise_003c_durable_supplier_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_recipient_email_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const freshSupplierId = "10000000-0000-4000-8000-000000000001";

test("MISE-005N pins supplier_recipients email CHECK shape to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005N"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists supplier_recipients_email_format_check/i
  );
  assert.match(
    migration,
    /add constraint supplier_recipients_email_format_check check \([\s\S]*email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /email collate "C" ~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  // Compose with MISE-005K: do not rewrite name bounds.
  assert.doesNotMatch(migration, /supplier_recipients_name_bounds_check/);
});

test("MISE-005N pins upsert_supplier_recipient email fail-closed to COLLATE C", () => {
  assert.match(
    migration,
    /create or replace function public\.upsert_supplier_recipient\(\s*p_restaurant_id uuid,\s*p_supplier_id uuid,\s*p_email text/i
  );
  assert.match(
    migration,
    /pg_catalog\.btrim\(coalesce\(p_email, ''\)\) collate "C"/
  );
  assert.match(
    migration,
    /normalized_email collate "C" ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /normalized_email collate "C" !~ '\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$'/
  );
  assert.match(
    migration,
    /grant execute on function public\.upsert_supplier_recipient\(uuid, uuid, text\)\s+to authenticated/i
  );
});

test("original recipient management left email shape on bare [[:space:]]", () => {
  assert.match(
    originalRecipients,
    /email ~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'/
  );
  assert.doesNotMatch(originalRecipients, /email collate "C" ~/);
});

test("durable-identity upsert originally used bare lower/cntrl/space on email", () => {
  assert.match(
    durableIdentity,
    /normalized_email text := pg_catalog\.lower\(pg_catalog\.btrim\(coalesce\(p_email, ''\)\)\);/
  );
  assert.match(
    durableIdentity,
    /normalized_email ~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    durableIdentity,
    /normalized_email !~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'/
  );
  assert.doesNotMatch(
    durableIdentity,
    /btrim\(coalesce\(p_email, ''\)\) collate "C"/
  );
});

test("pgTAP fixture pins email CHECK and upsert fail-closed", () => {
  assert.match(pgTap, /select plan\(10\)/);
  assert.match(pgTap, /supplier_recipients_email_format_check/);
  assert.match(pgTap, /email CHECK uses COLLATE C \[\[:space:\]\] shape/);
  assert.match(pgTap, /upsert lower\/btrim email uses COLLATE C/);
  assert.match(pgTap, /upsert shape fail-closed uses COLLATE C/);
});

test("domain mirrors ASCII C [[:space:]] rejection and A-Z lower", () => {
  assert.match(validation, /MISE-005N/);
  assert.match(validation, /SUPPLIER_RECIPIENT_EMAIL_SHAPE/);
  assert.equal(SUPPLIER_RECIPIENT_EMAIL_SHAPE.source.includes("\\s"), false);
  assert.equal(matchesSupplierRecipientEmailShape("orders@fresh.test"), true);
  assert.equal(matchesSupplierRecipientEmailShape("orders\t@fresh.test"), false);
  assert.equal(matchesSupplierRecipientEmailShape("orders\n@fresh.test"), false);
  assert.equal(matchesSupplierRecipientEmailShape("orders fresh@test.example"), false);
  assert.equal(matchesSupplierRecipientEmailShape("not-an-email"), false);
  // JS \\s would reject NBSP; COLLATE C [[:space:]] does not treat U+00A0 as space.
  assert.equal(matchesSupplierRecipientEmailShape("orders\u00a0@fresh.test"), true);
  assert.equal(normalizeSupplierRecipientEmail(" ORDERS@Fresh.Example "), "orders@fresh.example");
  // A-Z fold only: keep Latin-1 capital É unchanged (matches lower(... COLLATE "C")).
  assert.equal(normalizeSupplierRecipientEmail("CAFÉ@Fresh.Example"), "cafÉ@fresh.example");
});

test("requireSupplierRecipientInput uses COLLATE C email contract", () => {
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: "restaurant_a",
      supplier_id: freshSupplierId,
      email: " ORDERS@Fresh.Example "
    }),
    {
      restaurant_id: "restaurant_a",
      supplier_id: freshSupplierId,
      email: "orders@fresh.example"
    }
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: "restaurant_a",
        supplier_id: freshSupplierId,
        email: "orders\t@fresh.test"
      }),
    /valid supplier email/i
  );
});
