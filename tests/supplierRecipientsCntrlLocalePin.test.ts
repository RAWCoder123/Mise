import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  requireSupplierDisplayName,
  requireSupplierRecipientInput
} from "../services/miseValidation";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260926050500_mise_005k_supplier_recipients_cntrl_locale_pin.sql",
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
    "../supabase/tests/database/supplier_recipients_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const restaurantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const supplierId = "10000000-0000-4000-8000-000000000001";

test("MISE-005K pins supplier_recipients cntrl CHECKs to COLLATE C", () => {
  assert.ok(migration.includes("MISE-005K"), "additive pin must stay labeled");
  assert.match(
    migration,
    /drop constraint if exists supplier_recipients_name_bounds_check/i
  );
  assert.match(
    migration,
    /drop constraint if exists supplier_recipients_email_format_check/i
  );
  assert.match(
    migration,
    /supplier_name collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    migration,
    /email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  // Preserve length / trim / address-shape contract besides cntrl.
  assert.match(migration, /between 1 and 160/);
  assert.match(migration, /between 3 and 254/);
  assert.match(
    migration,
    /\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$/
  );
  // Compose with open stacks: do not rewrite upsert / setup RPCs.
  assert.doesNotMatch(
    migration,
    /create or replace function (public|private)\./i
  );
});

test("supplier recipient management originally left name/email cntrl unpinned", () => {
  assert.match(
    originalRecipientManagement,
    /supplier_name !~ '\[\[:cntrl:\]\]'/
  );
  assert.match(
    originalRecipientManagement,
    /email !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalRecipientManagement,
    /supplier_name collate "C" !~ '\[\[:cntrl:\]\]'/
  );
  assert.doesNotMatch(
    originalRecipientManagement,
    /email collate "C" !~ '\[\[:cntrl:\]\]'/
  );
});

test("pgTAP pins supplier_recipients cntrl CHECKs to COLLATE C", () => {
  assert.ok(pgTap.includes("MISE-005K"));
  assert.match(
    pgTap,
    /supplier_name collate "C" !~ ''\[\[:cntrl:\]\]''/
  );
  assert.match(
    pgTap,
    /email collate "C" !~ ''\[\[:cntrl:\]\]''/
  );
  assert.match(pgTap, /ASCII tab is a control under COLLATE C/);
  assert.match(pgTap, /ASCII DEL is a control under COLLATE C/);
});

test("client validation already rejects ASCII controls matching COLLATE C", () => {
  assert.match(
    validation,
    /\/\[\\u0000-\\u001f\\u007f\]\/\.test\(value\)/
  );
  assert.throws(
    () => requireSupplierDisplayName("Fresh\tFoods"),
    /Supplier name must be between 1 and 160 characters/
  );
  assert.throws(
    () =>
      requireSupplierRecipientInput({
        restaurant_id: restaurantId,
        supplier_id: supplierId,
        email: "orders\u007f@fresh.test"
      }),
    /Enter a valid supplier email address/
  );
  assert.deepEqual(
    requireSupplierRecipientInput({
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: " ORDERS@Fresh.Test "
    }),
    {
      restaurant_id: restaurantId,
      supplier_id: supplierId,
      email: "orders@fresh.test"
    }
  );
});
