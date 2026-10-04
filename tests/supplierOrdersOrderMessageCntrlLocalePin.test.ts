import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261004150000_mise_005hc_supplier_orders_order_message_cntrl_locale_pin.sql",
    import.meta.url
  ),
  "utf8"
);
const original = readFileSync(
  new URL(
    "../supabase/migrations/20260714183313_bound_resources_and_staging_identity.sql",
    import.meta.url
  ),
  "utf8"
);
const operationalConstraints = readFileSync(
  new URL(
    "../supabase/migrations/20260625212050_operational_constraints.sql",
    import.meta.url
  ),
  "utf8"
);
const pgTap = readFileSync(
  new URL(
    "../supabase/tests/database/supplier_orders_order_message_cntrl_locale_pin.test.sql",
    import.meta.url
  ),
  "utf8"
);
const validation = readFileSync(
  new URL("../services/miseValidation.ts", import.meta.url),
  "utf8"
);

const sqlBody = migration.replace(/^--.*$/gm, "");
const multilineControlClass = ["[", "\\x00-\\x08", "\\x0B", "\\x0C", "\\x0E-\\x1F", "\\x7F", "]"].join(
  ""
);

test("MISE-005HC pins order_message CHECK to COLLATE C multiline-aware cntrl rejection", () => {
  assert.ok(migration.includes("MISE-005HC"), "additive pin must stay labeled");

  assert.match(
    migration,
    /add constraint supplier_orders_message_size_check check \(\s*octet_length\(order_message\) <= 65536\s*and order_message collate "C" !~ E'/
  );
  assert.ok(
    migration.includes(`order_message collate "C" !~ E'${multilineControlClass}'`),
    "order_message CHECK must pin multiline-aware cntrl rejection under COLLATE C"
  );
  assert.ok(
    migration.includes("octet_length(order_message) <= 65536"),
    "exact octet_length bound must be preserved"
  );
  assert.ok(
    !migration.includes("order_message is null"),
    "order_message is NOT NULL; message_size CHECK must not add a null OR branch"
  );

  // Compose: CHECK-only. Do not rewrite supplier-send builders or sibling tips.
  assert.doesNotMatch(sqlBody, /create or replace function/i);
  assert.doesNotMatch(sqlBody, /create policy/i);
  assert.doesNotMatch(sqlBody, /build_supplier_order_message/i);
  assert.doesNotMatch(sqlBody, /supplier_orders_operational_values_check/);
  assert.doesNotMatch(sqlBody, /supplier_orders_operator_note/);
  assert.doesNotMatch(sqlBody, /supplier_orders_supplier_name_check/);
  assert.doesNotMatch(sqlBody, /provider_message_id/);
  assert.doesNotMatch(sqlBody, /\[\[:cntrl:\]\]/);
});

test("original order_message size CHECK had octet_length only without cntrl gate", () => {
  assert.match(
    original,
    /add constraint supplier_orders_message_size_check check \(octet_length\(order_message\) <= 65536\)/
  );
  assert.doesNotMatch(
    original,
    /supplier_orders_message_size_check[\s\S]*?(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );

  assert.match(
    operationalConstraints,
    /add constraint supplier_orders_operational_values_check\s+check \(\s*length\(trim\(supplier_name\)\) > 0 and\s+length\(trim\(order_message\)\) > 0\s*\)/
  );
  assert.doesNotMatch(
    operationalConstraints,
    /supplier_orders_operational_values_check[\s\S]*?(?:\[\[:cntrl:\]\]|\\x00-\\x08)/
  );
});

test("client supplier-send body validator shares the multiline control allowlist", () => {
  assert.match(
    validation,
    /const unsafeSupplierSendMultilineControlPattern =\s*\/\[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\]\//
  );
  assert.match(
    validation,
    /function requireSupplierSendBody[\s\S]*?unsafeSupplierSendMultilineControlPattern\.test\(value\)/
  );
});

test("pgTAP plan is derived from assertion call sites, not from a passing run", () => {
  const planMatch = pgTap.match(/select plan\((\d+)\);/);
  assert.ok(planMatch, "pgTAP file must declare an explicit plan");
  const planned = Number(planMatch[1]);

  const assertionCalls = [
    ...pgTap.matchAll(
      /^\s*select\s+(ok|is|matches|throws_ok|lives_ok|isnt|alike|throws_like)\s*\(/gim
    ),
  ];
  assert.equal(
    planned,
    assertionCalls.length,
    `plan(${planned}) must equal ${assertionCalls.length} assertion call sites counted from source`
  );

  assert.ok(
    pgTap.includes(`!~ E'${multilineControlClass}'`),
    "pgTAP must exercise the exact COLLATE C multiline control class"
  );
  assert.match(pgTap, /octet_length\\\(order_message\\\) <= 65536/);
  assert.match(pgTap, /supplier_orders operational_values_check remains attached/);
  assert.match(
    pgTap,
    /supplier_orders operational_values_check still excludes order_message cntrl/
  );
  assert.match(pgTap, /LF in order_message text is accepted/);
  assert.match(pgTap, /DEL in order_message text is rejected/);
});
