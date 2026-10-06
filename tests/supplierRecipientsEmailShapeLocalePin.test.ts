import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { requireSupplierRecipientInput } from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261007070000_mise_005iu_supplier_recipients_email_shape_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const originalRecipientManagement = readFileSync(
  new URL(
    "../supabase/migrations/20260719214822_supplier_recipient_management.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_recipients_email_shape_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const supplierId = "10000000-0000-4000-8000-000000000001";

test("MISE-005IU pins supplier_recipients.email CHECK to COLLATE C mailbox shape", () => {
  assert.ok(migration.includes("MISE-005IU"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_recipients_email_format_check check \(\s*email is null or \(\s*pg_catalog\.length\(email\) between 3 and 254\s*and email = pg_catalog\.btrim\(email\)\s*and email collate "C" !~ '\[\[:cntrl:\]\]'\s*and email collate "C" ~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'\s*\)\s*\)/
  );
  assert.ok(
    migration.includes(`email collate "C" !~ '[[:cntrl:]]'`),
    "recipients email CHECK must pin cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes(
      `email collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`
    ),
    "recipients email CHECK must pin mailbox shape under COLLATE C"
  );
  assert.ok(
    migration.includes("pg_catalog.length(email) between 3 and 254"),
    "exact length bound must match foundation recipient email contract"
  );

  // Compose: CHECK-only. Do not rewrite upsert/setup RPCs or name_bounds.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /create trigger/i);
  assert.doesNotMatch(sqlBody, /upsert_supplier_recipient/i);
  assert.doesNotMatch(sqlBody, /save_restaurant_setup/i);
  assert.doesNotMatch(
    sqlBody,
    /add constraint supplier_recipients_name_bounds_check/i,
    "must not reattach name_bounds CHECK by name rewrite"
  );
  assert.ok(
    sqlBody.includes("supplier_recipients_name_bounds_check"),
    "drop loop must explicitly spare name_bounds sibling tip"
  );
  assert.doesNotMatch(sqlBody, /outreach_/i);
  assert.doesNotMatch(sqlBody, /gmail_credentials/i);
  assert.doesNotMatch(sqlBody, /restaurant_email_connections/i);
});

test("original supplier_recipients.email left cntrl and shape unpinned to COLLATE C", () => {
  assert.match(
    originalRecipientManagement,
    /add constraint supplier_recipients_email_format_check check \(\s*email is null or \(\s*pg_catalog\.length\(email\) between 3 and 254\s*and email = pg_catalog\.btrim\(email\)\s*and email !~ '\[\[:cntrl:\]\]'\s*and email ~ '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$'\s*\)\s*\)/
  );
  assert.doesNotMatch(
    originalRecipientManagement,
    /email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalRecipientManagement,
    /email collate "C" ~ '\^\[\^@\[:space:\]\]/
  );
});

test("client validation already rejects ASCII controls and spaces matching COLLATE C", () => {
  assert.match(
    validation,
    /\/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\)/
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders\u0009@fresh.test"
      }),
    /Enter a valid supplier email address/
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders @fresh.test"
      }),
    /Enter a valid supplier email address/
  );
  assert.doesNotThrow(() =>
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@fresh.test"
    })
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    )
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.match(pgTap, /supplier_recipients_email_format_check exists/);
  assert.match(pgTap, /recipients email CHECK keeps exact length bound/);
  assert.match(pgTap, /recipients email CHECK requires trimmed storage/);
  assert.match(pgTap, /recipients email CHECK uses COLLATE C cntrl rejection/);
  assert.match(pgTap, /recipients email CHECK uses COLLATE C mailbox shape/);
  assert.match(pgTap, /printable mailbox recipient email is accepted under COLLATE C/);
  assert.match(pgTap, /tab in recipient email local-part is rejected under COLLATE C/);
  assert.match(pgTap, /newline in recipient email domain is rejected under COLLATE C/);
  assert.match(pgTap, /NUL in recipient email domain is rejected under COLLATE C/);
  assert.match(pgTap, /space in recipient email local-part is rejected under COLLATE C/);
  assert.match(pgTap, /recipient email control and space detectors match ASCII C classes/);
  assert.match(
    pgTap,
    /ASCII recipient email detectors are identical under C and under the database ctype/
  );
});
